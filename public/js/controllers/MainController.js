'use strict';
function focusInput() {
    document.getElementById('textInput').focus();
}
exports = module.exports = [
    '$log',
    '$rootScope',
    '$scope',
    '$timeout',
    '$window',

    'Account',
    'Group',
    'Message',
    'File',
    'moment',
    'favicon',
    'scrollChatToBottom',

    function (
        $log,
        $rootScope,
        $scope,
        $timeout,
        $window,

        Account,
        Group,
        Message,
        File,
        moment,
        favicon,
        scrollChatToBottom

    ) {
        // make available to the view
        $scope.moment = moment;
        $scope.account = $rootScope.account;

        $scope.showFullChat = true;
        $scope.showSettings = false;
        $scope.toggleSettings = function (override) {
            $scope.showSettings = typeof override !== 'undefined' ? override : !$scope.showSettings;
            if ($scope.showSettings) {
                $window.pixies.resume();
            }
            else {
                $window.pixies.stop();
                $timeout(scrollChatToBottom);
            }
        };
        $scope.selectedChat = null;

        $scope.activeCall = null;
        $scope.incomingCall = "";
        $scope.messagesDuringBlur = 0;
        $scope.windowInFocus = true;

        $scope.recentQuery = "";
        $scope.filterRecents = function (val) {
            if (!$scope.recentQuery) {
                return true;
            }
            var re = new RegExp($scope.recentQuery, 'i');
            if (re.test(val._id)) {
                return true;
            }
            if (val.display && re.test(val.display)) {
                return true
            }
            return false;
        };

        $window.addEventListener('focus', function () {
            $scope.windowInFocus = true;
            $scope.messagesDuringBlur = 0;
            favicon($scope.messagesDuringBlur);

            if ($scope.selectedChat) {
                if ($scope.selectedChat.unread) {
                    scrollChatToBottom();
                }
                $scope.selectedChat.unread = 0;
                $scope.$apply();
            }
            // force chat scrolling to the bottom, because it will not scroll
            // when the window is out of focus on some browsers
        });
        $window.addEventListener('blur', function () {
            $scope.windowInFocus = false;
        });

        Account.get(function (err, accounts) {
            if (err) {
                $rootScope.notifications.push(err);
                return;
            }

            var listeners = accounts.map(buildAccount);

            if ($rootScope.client.connectionId) {
                listeners.forEach(function (listener) {
                    listener();
                });
            }
            else {
                $rootScope.client.listen('connect', function addPresenceListeners() {
                    listeners.forEach(function (listener) {
                        listener();
                    });
                });
            }
        });
        function buildAccount(account) {
            $rootScope.recents[account._id] = account;
            $rootScope.recents[account._id].messages = [];
            $rootScope.recents[account._id].presence = "unavailable";
            return setPresenceListener(account._id);
        }
        function setPresenceListener(endpt) {
            return function () {
                $rootScope.recents[endpt].endpoint = $rootScope.client.getEndpoint({ id: endpt });
                $rootScope.recents[endpt].endpoint.listen('presence', function (evt) {
                    $log.debug('presence for endpoint', evt);
                    $rootScope.recents[endpt].presence = evt.presence;
                    $scope.$apply();
                });
            };
        }
    
        function bindGroup(group) {
            $rootScope.client.join({
                id: group._id,
                onSuccess: function (evt) {
                    $log.debug('joined ' + group._id);
                    // if this was a rejoin, use the existing messages
                    var msgs = $rootScope.recents['group-' + group._id]
                        ? $rootScope.recents['group-' + group._id].messages || []
                        : [];
                    $rootScope.recents['group-' + group._id] = group;
                    $rootScope.recents['group-' + group._id].messages = msgs;
                    $rootScope.$apply();
                },
                onError: function (evt) {
                    $log.debug('FAIL joining ' + group._id, evt);
                }
            });
        }

        Group.get(function (err, groups) {
            if (err) {
                $rootScope.notifications.push(err);
                return;
            }
            // already connected
            if ($rootScope.client.connectionId) {
                groups.forEach(bindGroup);
            }
            else {
                $rootScope.client.listen('connect', function joinGroups() {
                    groups.forEach(bindGroup);
                });
            }
        });

        // receiving messages
        $rootScope.client.ignore('message');
        $rootScope.client.listen('message', function (evt) {
            // System messages
            if (evt.group && evt.group.id === $rootScope.systemGroupId) {
                $log.debug('system message', evt);

                var msg = evt.message.message.split('-');
                var msgType = msg[0];
                var msgValue = msg[1];

                switch (msgType) {
                    case 'newaccount':
                        Account.get(msgValue, function (err, account) {
                            if (err) {
                                $rootScope.notifications.push(err);
                                return;
                            }
                            buildAccount(account)();
                        });
                    break;
                    case 'newgroup':
                        Group.get(msgValue, function (err, group) {
                            if (err) {
                                $rootScope.notifications.push(err);
                                return;
                            }
                            bindGroup(group);
                        });
                    break;
                    case 'removegroup':
                        if ($rootScope.recents['group-' + msgValue]) {
                            if ($scope.selectedChat._id === 'group-' + msgValue) {
                                $rootScope.notifications.push(
                                    "Group " + msgValue + " was just deleted by the owner."
                                );
                                $scope.selectedChat = null;
                            }
                            delete $rootScope.recents['group-' + msgValue];
                            $rootScope.client.getGroup({ id: msgValue }).leave();
                            $rootScope.$apply();
                        }
                    break;
                }
                return;
            }

            var itemId = evt.group ? 'group-' + evt.group.id : evt.message.endpointId;

            // video call request
            var systemIndicator = evt.message.message.substring(0, 15);
            var systemIndicatorValue = evt.message.message.substring(15);
            if (systemIndicator === '!!!VIDEOCALL!!!') {
                $scope.incomingCall = systemIndicatorValue;
                $scope.activeCall = {
                    remoteEndpoint: $rootScope.recents[itemId],
                    hasVideo: true
                };
                $scope.activeCall.remoteEndpoint.id = itemId;

                $rootScope.audio.callIncoming.play();
                $rootScope.audio.callIncoming.loop = true;
                $scope.$apply();
                return;
            }


            // Normal messages

            // Adding the message to local history
            if (evt.group) {
                $rootScope.recents[itemId].messages.push({
                    group: evt.group.id,
                    from: $rootScope.recents[evt.message.endpointId],
                    content: evt.message.message,
                    created: new Date()
                });
            }
            else {
                $rootScope.recents[itemId].messages.push({
                    from: $rootScope.recents[itemId],
                    to: $rootScope.account,
                    content: evt.message.message,
                    created: new Date()
                });
            }

            // Playing sounds
            // they do not play when you have focus on the window and are viewing the chat
            if (
                !$scope.windowInFocus
                || !$scope.selectedChat
                || itemId !== $scope.selectedChat._id
            ) {
                $log.debug('group sound', evt.group, $rootScope.account.settings.groupMessageSounds);
                if (evt.group && $rootScope.account.settings.groupMessageSounds) {
                    $rootScope.audio.messageGroup.play();
                }
                else if (!evt.group && $rootScope.account.settings.privateMessageSounds) {
                    $rootScope.audio.messagePrivate.play();
                }
            }

            // Tracking unread items on this chat
            $rootScope.recents[itemId].unread = $rootScope.recents[itemId].unread || 0;
            if (!$scope.windowInFocus || ($scope.selectedChat && itemId !== $scope.selectedChat._id)) {
                $rootScope.recents[itemId].unread++;
            }

            // Update favicon while window is out of focus
            if (!$scope.windowInFocus) {
                $scope.messagesDuringBlur++
                favicon($scope.messagesDuringBlur);
            }

            $rootScope.$apply();

        });
        
        // receive calls
        $rootScope.client.ignore('call');
        $rootScope.client.listen('call', function (evt) {
            // when we are the caller, no need to display the incoming call
            if (evt.call.caller) {
                return;
            }
            // only allow one call at a time.
            if ($scope.activeCall) {
                $rootScope.notifications.push(
                    $rootScope.recents[evt.endpoint.id].display
                    + ' tried to call you.'
                );
                evt.call.hangup();
                $scope.$apply();
                return;
            }

            $scope.activeCall = evt.call;
            $scope.incomingCall = $rootScope.recents[evt.endpoint.id].display;
            $rootScope.audio.callIncoming.play();
            $rootScope.audio.callIncoming.loop = true;
            $scope.$apply();
        });

        $scope.createGroup = function (groupName) {
            Group.create({
                _id: groupName
            }, function (err, group) {
                if (err) {
                    $rootScope.notifications.push(err);
                    return;
                }
                bindGroup(group);
            });
        };

        $scope.switchChat = function (id) {
            $log.debug('switchChat', id);
            if (id === $rootScope.account._id) {
                $log.debug('not switching to chat because it is self');
                return;
            }
            $scope.toggleSettings(false);
            // reset the current chat unreads to zero
            if ($scope.selectedChat) {
                $scope.selectedChat.unread = 0;
            }
            
            // switch the chat
            $scope.selectedChat = $rootScope.recents[id];
            // reset the NEW chat unreads to zero
            $scope.selectedChat.unread = 0;

            // fetch messages if there arent very many
            if ($scope.selectedChat.messages.length < 25) {
                var qs;
                if ($scope.selectedChat.display) {
                    qs = '?account=' + $scope.selectedChat._id;
                }
                else {
                    qs = '?group=' + $scope.selectedChat._id;
                }
                Message.get(qs, function (err, messages) {
                    if (err) {
                        $rootScope.notifications.push(err);
                        return;
                    }
                    // Messages are sorted descending from the server, to capture
                    // the latest ones. So to get the most recent on the bottom, 
                    // the array gets reversed.
                    messages.reverse();
                    $scope.selectedChat.messages = messages;
                    scrollChatToBottom();
                    focusInput();
                });
            }
            else if ($scope.selectedChat.messages.length > 100) {
                var overLimit = $scope.selectedChat.messages.length - 100;
                $scope.selectedChat.messages.splice(0, overLimit);
            }
            $timeout(function () {
                scrollChatToBottom();
            });
        };


        $scope.audioCall = function (id) {
            $log.debug('audio call requested with ', id);
            var endpoint = $rootScope.client.getEndpoint({ id: id });
            $scope.activeCall = endpoint.startAudioCall();
            $log.debug('activeCall', $scope.activeCall);
            $scope.activeCall.listen('hangup', function () {
                $scope.activeCall = null;

                // in case the hangup happened before the answer
                $rootScope.audio.callIncoming.pause();
                $rootScope.audio.callIncoming.loop = false;
                $rootScope.audio.callIncoming.currentTime = 0;
                $scope.$apply();
            });
        };
        $scope.hangup = function () {
            if ($scope.activeCall) {
                if ($scope.activeCall.hangup) {
                    $scope.activeCall.hangup();
                }
                $scope.activeCall = null;
                // in case we were being rung
                $scope.incomingCall = "";
                $rootScope.audio.callIncoming.pause();
                $rootScope.audio.callIncoming.loop = false;
                $rootScope.audio.callIncoming.currentTime = 0;
                $rootScope.setPresence('available');
            }
        };
        $scope.answer = function () {
            if ($scope.activeCall) {
                $rootScope.setPresence('busy');
                
                // answer video call
                if ($scope.activeCall.hasVideo) {
                    $scope.activeCall = null;
                    window.open('/private/' + $scope.incomingCall, '_blank');
                }
                // answer audio call
                else {
                    $scope.activeCall.answer({
                        constraints: {
                            audio: true
                        }
                    });
                }
                $scope.incomingCall = "";
                $rootScope.audio.callIncoming.pause();
                $rootScope.audio.callIncoming.loop = false;
                $rootScope.audio.callIncoming.currentTime = 0;
            }
        };

        $scope.videoCall = function (id) {
            var msg = {
                content: '!!!VIDEOCALL!!!' + $rootScope.account._id,
                to: id,
                offRecord: true
            };
            Message.create(msg, function (err, msg) {
                if (err) {
                    $rootScope.notifications,push(err);
                    return;
                }
                window.open('/private/' + $rootScope.account._id, '_blank');
            });
        };
    }

];
