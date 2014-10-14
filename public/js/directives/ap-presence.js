'use strict';
/**
 * The chat window.
 * The parent scope **must** implement the object `selectedChat`.
 */
exports = module.exports = [
    '$rootScope',
    '$timeout',
    function ($rootScope, $timeout) {
        return {
            scope: {
                presence: '@presence'
            },
            link: function (scope, element, attrs) {
                scope.colors = {
                    'unavailable': 'gray',
                    'available': 'text-success',
                    'busy': 'text-warning',
                    'away': 'text-danger',
                };
            },
            template: '<span class="presence"><i class="fa fa-circle {{colors[presence]}}"></i></span>'
        };
    }
];
