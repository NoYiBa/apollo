/*!
 * Copyright 2014, Digium, Inc.
 * All rights reserved.
 *
 * This source code is licensed under The AGPL v3 License found in the
 * LICENSE file in the root directory of this source tree.
 *
 * For all details and documentation:  https://www.respoke.io
 */
var config = require('./config');

exports = module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-compress');
    grunt.loadNpmTasks('grunt-node-webkit-builder');


    grunt.initConfig({
        copy: {
            nwk: {
                files: {
                    './public/release/app/apollo.png': './public/img/apollo-a.png',
                    './public/release/app/apollo.ico': './public/img/apollo-a-tile.ico',
                    './public/release/app/apollo.icns': './public/img/apollo-a.icns',
                    './public/release/app/package.json': './nodewebkit.json',
                    './public/release/app/passthrough.html': './public/passthrough.html'
                }
            }
        },
        clean: {
            nwk: {
                src: ['./public/release/**/*']
            },
            pack: {
                src: ['./public/release/Apollo/', './public/release/app/']
            }
        },
        nodewebkit: {
            options: {
                version: '0.10.5',
                platforms: ['osx'],//, 'win', 'linux32', 'linux64'],
                buildDir: './public/release',
                macIcns: './public/release/app/apollo.icns',
                winIco: './public/release/app/apollo.ico',
                cacheDir: __dirname + '/../nodewebkit-cache'
            },
            src: ['./public/release/app/**/*']
        },
        compress: {
            osx: {
                options: {
                    archive: './public/release/osx.zip'
                },
                files: [
                    {expand: true, cwd: './public/release/' + config.name, src: ['./osx/**/*']}
                ]
            },
            win: {
                options: {
                    archive: './public/release/win.zip'
                },
                files: [
                    {expand: true, cwd: './public/release/' + config.name, src: ['./win/**/*']}
                ]
            },
            linux32: {
                options: {
                    archive: './public/release/linux32.zip'
                },
                files: [
                    {expand: true, cwd: './public/release/' + config.name, src: ['./linux32/**/*']}
                ]
            },
            linux64: {
                options: {
                    archive: './public/release/linux64.zip'
                },
                files: [
                    {expand: true, cwd: './public/release/' + config.name, src: ['./linux64/**/*']}
                ]
            }
        }
    });

    grunt.registerTask('release', [
        'clean',
        'copy:nwk',
        'nodewebkit'
    ]);

    grunt.registerTask('pack', [
        // 'compress',
        'compress:osx',
        'clean:pack'
    ]);
};
