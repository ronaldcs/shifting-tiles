/**
 * main.js
 */
var injector;
(function() {
  'use strict';

  angular.module('shiftingTilesEx', [
      'ngAnimate',
      'ngRoute'
    ])
    .config(['$routeProvider', '$compileProvider', function($routeProvider, $compileProvider) {
      $routeProvider
        .when("/", {}) /* Default route redirect */
        .otherwise({
          redirectTo: "/"
        });
      $compileProvider.debugInfoEnabled(false); /* $compileProvider options */
    }])
    /* The main controller to start up the load animation */
    .controller('mainCtrl', ['$scope', function($scope) {
      var vm = this;
    }])
    /* Just a utility function to shuffle arrays */
    .factory('shuffle', function() {
      return function(array) {
        return array
          .map(function(n) {
            return [Math.random(), n];
          })
          .sort().map(function(n) {
            return n[1];
          });
      }
    })
    /* See http://greensock.com/forums/topic/10051-animations-pause-when-browser-tab-is-not-visible/ */
    .factory('hasFocus', function() {
      var stateKey,
        eventKey,
        keys = {
          hidden: "visibilitychange",
          webkitHidden: "webkitvisibilitychange",
          mozHidden: "mozvisibilitychange",
          msHidden: "msvisibilitychange"
        };
      for (stateKey in keys) {
        if (stateKey in document) {
          eventKey = keys[stateKey];
          break;
        }
      }
      return function(c) {
        if (c) document.addEventListener(eventKey, c);
        return !document[stateKey];
      }
    })
    /**
     * shifting-tiles START
     */
    /* shifting-tiles: Picture URL factory for the shifting-tiles directive */
    .factory('pictureFactory', ['$http', '$q', 'shuffle', function($http, $q, shuffle) {
      return {
        fetchData: function(w) {
          var deferred = $q.defer();
          var req = {
            method: 'GET',
            url: 'https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=432ba41d8cde6301b7532a45398bd945&tags=' + shuffle(w.searchTags.split(',').map(function(o) {
              return o.trim();
            })).join(',') + '&sort=relevance&content_type=1&media=photos&extras=url_t,tags&privacy_filter=1&safe_search=1&per_page=100&page=1&format=json&nojsoncallback=1'
          };
          $http(req)
            .success(function(data, status) {
              deferred.resolve(data || {});
            })
            .error(function(error) {
              deferred.reject(error);
              console.log('exampleFactory ERROR', JSON.stringify(error));
            });
          return deferred.promise;
        }
      };
    }])
    /* shifting-tiles: The shifting-tiles controller */
    .controller('shiftingTilesCtrl', ['$scope', 'pictureFactory', '$interval', '$q', 'hasFocus', function($scope, pictureFactory, $interval, $q, hasFocus) {
      var me = this;
      var timer;
      var filterTags = function(tags) { /* Show only tags from the API data that were called */
        return tags.split(' ').filter(function(o) {
          var searchTags = me.shiftingTilesConfig.searchTags.split(',').map(function(s) {
            return s.trim();
          });
          for (var x = 0; x < searchTags.length; x++) {
            if (o.toLowerCase() === searchTags[x].toLowerCase()) return true;
          }
          return false;
        }).join(', ');
      };
      var handleData = function(d) { /* Show only landscape photos and map to a schema that we like */
        $scope.data = d.photos.photo.filter(function(o) {
            return (parseInt(o.width_t) > parseInt(o.height_t) ? o : false);
          })
          .map(function(o) {
            return {
              title: o.title,
              url: 'https://farm' + o.farm + '.staticflickr.com/' + o.server + '/' + o.id + '_' + o.secret + '.jpg',
              link: 'https://www.flickr.com/photos/' + o.owner + '/' + o.id,
              tags: filterTags(o.tags)
            };
          });
        return $scope.data;
      };
      me.paused = true;
      me.numPictures = 5;
      me.shiftingTilesConfig = angular.extend({}, $scope.shiftingTilesConfigDefault);
      me.refreshData = function(shiftingTilesConfig) { /* Use a promise to fetch the data */
        var deferred = $q.defer();
        var picturePromise = pictureFactory.fetchData(shiftingTilesConfig);
        picturePromise
          .then(
            function(d) {
              deferred.resolve(handleData(d));
            },
            function(error) {
              deferred.reject(error);
              console.log('pictureFactory ERROR', JSON.stringify(error));
            }
          );
        return deferred.promise;
      }
      me.slide = function(which) { /* This drives the ng-class, which, in turn, drives the animation */
        if (!me.paused && hasFocus() && $('.next').index() >= 0) {
          me.shiftingTilesConfig.pictures[which].slide = true;
        }
      };
      me.updatePictureState = function(oldPic, newPic) {
        me.updatePreload();
        me.shiftingTilesConfig.pictures[oldPic].title = me.preload.title; /* Set the picture sliding out as the next picture */
        me.shiftingTilesConfig.pictures[oldPic].url = me.preload.url;
        me.shiftingTilesConfig.pictures[oldPic].tags = me.preload.tags;
        me.shiftingTilesConfig.pictures[oldPic].slide = false;
        me.shiftingTilesConfig.pictures[oldPic].next = true;
        me.shiftingTilesConfig.pictures[newPic].next = false; /* Set the picture sliding in as not the next picture */
        $scope.$apply();
      };
      me.updatePreload = function() { /* Try and cache the next image so the UI seems more responsive */
        var i = Math.floor(Math.random() * ($scope.data.length));
        me.preload = {
          title: $scope.data[i].title,
          url: $scope.data[i].url,
          tags: filterTags($scope.data[i].tags)
        }
      }
      me.init = function() { /* This essentially drives the onEnter animation */
        var d = $scope.data;
        me.shiftingTilesConfig.pictures = [];
        for (var x = 0; x < me.numPictures; x++) {
          var i = Math.floor(Math.random() * (d.length));
          me.shiftingTilesConfig.pictures.push(angular.extend({}, d[i], {
            idx: x,
            height: '50%',
            width: '50%',
            next: false
          }));
        }
        me.shiftingTilesConfig.pictures[me.shiftingTilesConfig.pictures.length - 1].next = true;
        me.updatePreload();
      };
      me.pause = function(pause) {
        if (pause) {
          $interval.cancel(timer);
        } else {
          $interval.cancel(timer);
          timer = $interval(function() {
            var i = Math.floor(Math.random() * (me.shiftingTilesConfig.pictures.length));
            for (var x = 0; x < me.shiftingTilesConfig.pictures.length && me.shiftingTilesConfig.pictures[i].next; x++) { /* Randomly select which picture to animate and make sure it's not the next picture */
              i = Math.floor(Math.random() * (me.shiftingTilesConfig.pictures.length));
            }
            me.slide(i);
          }, me.shiftingTilesConfig.pictureFrequency);
        }
        me.paused = pause;
      };
      me.togglePause = function() {
        me.pause(!me.paused);
      };
      me.refreshData(me.shiftingTilesConfig).then(function() {
        $scope.vm.start = true;
      }); /* Start it */
    }])
    /* shifting-tiles: The shifting-tiles directive */
    .directive('shiftingTiles', function() {
      return {
        restrict: 'E',
        scope: {
          shiftingTilesConfigDefault: '=',
          vm: '='
        },
        controller: 'shiftingTilesCtrl',
        controllerAs: 'cvm',
        template: '<div class="tag-editor" ng-class="{ \'show-it\': cvm.showIt }"><input type="text" ng-model="cvm.shiftingTilesConfig.searchTags" /><div class="btn btn-save-tags" ng-click="cvm.showIt = false"><i class="fa fa-save"></i></div></div><div class="btn btn-edit-tags" ng-click="cvm.showIt = true"><i class="fa fa-pencil"></i></div><div class="picture-preloader" style="background-image: url({{ cvm.preload.url }});"></div><div class="pictures"><div class="picture-container" ng-repeat="picture in cvm.shiftingTilesConfig.pictures" ng-class="{ slide: picture.slide, next: picture.next }" ng-model="picture"><a href="{{ ::picture.link }}" target="_blank"><div class="picture" style="background-image: url({{ picture.url }});"><div class="tags"><i class="fa fa-tag"></i>{{ picture.tags }}</div></div></a></div></div>',
      }
    })
    /* shifting-tiles: Animation for individual pictures */
    .animation('.picture-container', function() {
      return {
        addClass: function(element, className, done) {
          if (className === 'slide') {
            var ctrl = element.data().$ngModelController;
            var shiftingTilesCtrl = element.parent().parent().data().$shiftingTilesController; /* Needed the shifting-tiles directive controller */
            var scaleToOptions = ['top', 'center', 'bottom'];
            var moveOptions = ['left', 'right'];
            var scaleTo = scaleToOptions[Math.floor(Math.random() * (scaleToOptions.length))]; /* Random scale to */
            var moveTo = moveOptions[Math.floor(Math.random() * (moveOptions.length))]; /* Random side */
            var tl = new TimelineMax();
            tl
              .clear()
              .to(element, 0.5, {
                scale: 0,
                transformOrigin: moveTo + ' ' + scaleTo,
                zIndex: 0
              })
              .set(element.parent().find('.next'), {
                opacity: 1,
                zIndex: 0,
                left: element.position().left + ((moveTo === 'left' ? 1 : -1) * element.width()),
                top: element.position().top,
                scale: 1
              }, '-=0.3')
              .to(element.parent().find('.next'), 1, {
                left: (moveTo === 'left' ? '-' : '+') + '=' + element.width(),
                ease: Bounce.easeOut
              }, '-=0.3')
              .fromTo(element.parent().find('.next').find('.tags'), 1, {
                bottom: -25
              }, { /* Slide in the next picture and set its bindings */
                bottom: 0,
                ease: Ease.easeOut,
                onComplete: function() {
                  shiftingTilesCtrl.updatePictureState(ctrl.$modelValue.idx, element.parent().find('.next').data().$ngModelController.$modelValue.idx);
                  element.parent().find('.next').css({
                    zIndex: 1
                  })
                  done();
                }
              }, '-=0.3');
          }
        },
        enter: function(element, done) {
          var ctrl = element.data().$ngModelController;
          var model = ctrl.$modelValue;
          var leftPosition = (model.next ? -10000 : (model.idx & 1 ? element.width() : 0)); /* Set the position of the picture outside of the viewport so that when the shifting-tiles element is visible, it's not seen */
          var topPosition = (model.idx > 1 ? element.height() : 0);
          var tl = new TimelineMax({
            delay: model.idx * 0.05
          }); /* This basically gives the stagger effect */
          tl
            .clear()
            .fromTo(element, 1, {
              left: leftPosition + (element.width() * 2),
              top: topPosition,
              opacity: 0,
              scale: 1
            }, {
              left: '-=' + (element.width() * 2),
              opacity: 1,
              ease: Bounce.easeOut
            }, 0.05)
            .fromTo(element.find('.tags'), 1, {
              bottom: -25
            }, {
              bottom: 0,
              ease: Ease.easeOut,
              onComplete: done
            });
        }
      }
    })
    /* shifting-tiles: Animation for the tag editor */
    .animation('.tag-editor', function() {
      return {
        addClass: function(element, className, done) {
          if (className === 'show-it') {
            var editBtn = element.parent().find('.btn-edit-tags');
            var tl = new TimelineMax();
            tl
              .clear()
              .to(editBtn, 0.25, {
                opacity: 0
              })
              .fromTo(element, 0.5, {
                opacity: 0,
                top: element.height() * -1
              }, {
                opacity: 1,
                top: 0,
                onComplete: function() {
                  element.parent().data().$shiftingTilesController.pause(true);
                }
              });
          }
        },
        removeClass: function(element, className, done) {
          if (className === 'show-it') {
            var cvm = element.parent().data().$shiftingTilesController;
            var editBtn = element.parent().find('.btn-edit-tags');
            var tl = new TimelineMax();
            tl
              .clear()
              .to(element, 0.25, {
                opacity: 0,
                top: element.height() * -1
              })
              .to(editBtn, 0.5, {
                opacity: 1,
                onComplete: function() {
                  if (element.find('input').data().$ngModelController.$dirty) { /* Check if dirty */
                    cvm.refreshData(cvm.shiftingTilesConfig).then(function() {
                      cvm.init();
                      cvm.pause(false);
                    });
                  } else cvm.pause(false); /* Otherwise, just unpause */
                }
              });
          }
        }
      }
    })
    /* shifting-tiles: Animation for the shifting-tiles element when it becomes visible (will essentially execute the .picture-container animation) */
    .animation('.shifting-tiles', ['$timeout', function($timeout) {
      return {
        addClass: function(element, className, done) { /* This is used simply to initialize the pictures array so that the onEnter animation fires */
          if (className === 'start') {
            var cvm = element.data().$shiftingTilesController;
            cvm.init();
            $timeout(function() {
              cvm.pause(false);
            }, 1);
          }
        },
        removeClass: function(element, className, done) {
          if (className === 'start') {
            TweenMax.to(element.find('.picture-container'), 0.5, {
              opacity: 0,
              onComplete: function() {
                element.data().$shiftingTilesController.pause(true);
                done();
              }
            });
          }
        }
      }
    }])
    /**
     * shifting-tiles END
     */
  injector = angular.bootstrap(document, ['shiftingTilesEx']); /* I do this out of habit in case I need it */
})();