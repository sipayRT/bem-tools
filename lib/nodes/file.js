var Q = require('q'),
    QFS = require('q-fs'),
    INHERIT = require('inherit'),
    PATH = require('path'),
    UTIL = require('util'),
    LOGGER = require('../logger'),

    Node = require('./node').Node;

var FileNode = exports.FileNode = INHERIT(Node, {

    buildMessageVerbosity: 'verbose',

    __constructor: function(path, optional) {
        this.path = path;
        this.optional = optional || false;
        this.__base(path);
    },

    getPath: function() {
        return this.path;
    },

    make: function(ctx) {
        if (this.optional) return;

        var _this = this;
        return QFS.exists(PATH.resolve(ctx.root, this.getPath()))
            .then(function(exists) {
                if (!exists) return Q.reject(UTIL.format("Path %j doesn't exist", _this.getPath()));
            });
    },

    lastModified: function(ctx) {
        return QFS.lastModified(PATH.resolve(ctx.root, this.getPath())).fail(function() {
            return -1;
        });
    }

});

exports.GeneratedFileNode = INHERIT(FileNode, {

    buildMessageVerbosity: 'info',

    isValid: function(ctx) {
        if (ctx.method && ctx.method != 'make') return false;
        if (ctx.force) return false;

        var arch = ctx.arch,
            parent = this.lastModified(ctx),
            children = arch.getChildren(this)
                .filter(function(child) {
                    return (child && (arch.getNode(child)) instanceof FileNode);
                })
                .map(function(child) {
                    return arch.getNode(child).lastModified(ctx);
                });

        // with no deps we must always check for file existance
        // isValid() == false will guarantee it
        if (!children.length) return false;

        var _this = this;
        return Q.all([parent].concat(children)).then(function(all) {
            var cur = all.shift(),
                max = Math.max.apply(Math, all);

            LOGGER.fdebug('*** isValid(%s): cur=%s, max=%s, valid=%s', _this.getId(), cur, max, cur >= max && max > -1);
            return cur >= max && max > -1;
        });
    },

    make: function() {},

    clean: function(ctx) {
        var _this = this;
        return QFS.remove(PATH.join(ctx.root, this.getId()))
            .then(function() {
                LOGGER.fverbose('Removed %j', _this.getId());
            })
            .fail(function() {});
    }

});