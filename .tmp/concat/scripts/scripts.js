/*!
 * angular-localization :: v1.2.2 :: 2015-07-15
 * web: http://doshprompt.github.io/angular-localization
 *
 * Copyright (c) 2015 | Rahul Doshi
 * License: MIT
 */
;(function (angular, window, document, undefined) {
    'use strict';

angular.module('ngLocalize.Version', [])
    .constant('localeVer', '1.2.2');
angular.module('ngLocalize', ['ngSanitize', 'ngLocalize.Config', 'ngLocalize.Events', 'ngLocalize.InstalledLanguages']);

angular.module('ngLocalize.InstalledLanguages', [])
    .value('localeSupported', [
        'en-US'
    ])
    .value('localeFallbacks', {
        'en': 'en-US'
    });
angular.module('ngLocalize')
    .service('locale', ["$injector", "$http", "$q", "$log", "$rootScope", "$window", "localeConf", "localeEvents", "localeSupported", "localeFallbacks", function ($injector, $http, $q, $log, $rootScope, $window, localeConf, localeEvents, localeSupported, localeFallbacks) {
        var TOKEN_REGEX = new RegExp('^[\\w\\.-]+\\.[\\w\\s\\.-]+\\w(:.*)?$'),

            currentLocale,
            deferrences,
            bundles,
            cookieStore;

        if (localeConf.persistSelection && $injector.has('$cookieStore')) {
            cookieStore = $injector.get('$cookieStore');
        }

        function isToken(str) {
            return (str && str.length && TOKEN_REGEX.test(str));
        }

        function getPath(tok) {
            var path = tok ? tok.split('.') : '',
                result = '';

            if (path.length > 1) {
                result = path.slice(0, -1).join('.');
            }

            return result;
        }

        function getKey(tok) {
            var path = tok ? tok.split('.') : [],
                result = '';

            if (path.length) {
                result = path[path.length - 1];
            }

            return result;
        }

        function getBundle(tok) {
            var result = null,
                path = tok ? tok.split('.') : [],
                i;

            if (path.length > 1) {
                result = bundles;

                for (i = 0; i < path.length - 1; i++) {
                    if (result[path[i]]) {
                        result = result[path[i]];
                    } else {
                        result = null;
                        break;
                    }
                }
            }

            return result;
        }

        function loadBundle(token) {
            var path = token ? token.split('.') : '',
                root = bundles,
                url = localeConf.basePath + '/' + currentLocale,
                i;

            if (path.length > 1) {
                for (i = 0; i < path.length - 1; i++) {
                    if (!root[path[i]]) {
                        root[path[i]] = {};
                    }
                    root = root[path[i]];
                    url += '/' + path[i];
                }

                if (!root._loading) {
                    root._loading = true;

                    url += localeConf.fileExtension;

                    $http.get(url)
                        .success(function (data) {
                            var key,
                                path = getPath(token);
                            // Merge the contents of the obtained data into the stored bundle.
                            for (key in data) {
                                if (data.hasOwnProperty(key)) {
                                    root[key] = data[key];
                                }
                            }

                            // Mark the bundle as having been "loaded".
                            delete root._loading;

                            // Notify anyone who cares to know about this event.
                            $rootScope.$broadcast(localeEvents.resourceUpdates);

                            // If we issued a Promise for this file, resolve it now.
                            if (deferrences[path]) {
                                deferrences[path].resolve(path);
                            }
                        })
                        .error(function () {
                            $log.error('[localizationService] Failed to load: ' + url);

                            // We can try it again later.
                            delete root._loading;
                        });
                }
            }
        }

        function bundleReady(path) {
            var bundle,
                token;

            path = path || localeConf.langFile;
            token = path + '._LOOKUP_';

            bundle = getBundle(token);

            if (!deferrences[path]) {
                deferrences[path] = $q.defer();
            }

            if (bundle && !bundle._loading) {
                deferrences[path].resolve(path);
            } else {
                if (!bundle) {
                    loadBundle(token);
                }
            }

            return deferrences[path].promise;
        }

        function ready(path) {
            var paths,
                deferred,
                outstanding;

            if (angular.isString(path)) {
                paths = path.split(',');
            } else if (angular.isArray(path)) {
                paths = path;
            } else {
                throw new Error('locale.ready requires either an Array or comma-separated list.');
            }

            if (paths.length > 1) {
                outstanding = [];
                paths.forEach(function (path) {
                    outstanding.push(bundleReady(path));
                });
                deferred = $q.all(outstanding);
            } else {
                deferred = bundleReady(path);
            }

            return deferred;
        }

        function applySubstitutions(text, subs) {
            var res = text,
                firstOfKind = 0;

            if (subs) {
                if (angular.isArray(subs)) {
                    angular.forEach(subs, function (sub, i) {
                        res = res.replace('%' + (i + 1), sub);
                        res = res.replace('{' + (i + 1) + '}', sub);
                    });
                } else {
                    angular.forEach(subs, function (v, k) {
                        ++firstOfKind;

                        res = res.replace('{' + k + '}', v);
                        res = res.replace('%' + k, v);
                        res = res.replace('%' + (firstOfKind), v);
                        res = res.replace('{' + (firstOfKind) + '}', v);
                    });
                }
            }
            res = res.replace(/\n/g, '<br>');

            return res;
        }

        function getLocalizedString(txt, subs) {
            var result = '',
                bundle,
                key,
                A,
                isValidToken = false;

            if (angular.isString(txt) && !subs && txt.indexOf(localeConf.delimiter) !== -1) {
                A = txt.split(localeConf.delimiter);
                txt = A[0];
                subs = angular.fromJson(A[1]);
            }

            isValidToken = isToken(txt);
            if (isValidToken) {
                if (!angular.isObject(subs)) {
                    subs = [subs];
                }

                bundle = getBundle(txt);
                if (bundle && !bundle._loading) {
                    key = getKey(txt);

                    if (bundle[key]) {
                        result = applySubstitutions(bundle[key], subs);
                    } else {
                        $log.info('[localizationService] Key not found: ' + txt);
                        result = '%%KEY_NOT_FOUND%%';
                    }
                } else {
                    if (!bundle) {
                        loadBundle(txt);
                    }
                }
            } else {
                result = txt;
            }

            return result;
        }

        function setLocale(value) {
            var lang;

            if (angular.isString(value)) {
                value = value.trim();
                if (localeSupported.indexOf(value) !== -1) {
                    lang = value;
                } else {
                    lang = localeFallbacks[value.split('-')[0]];
                    if (angular.isUndefined(lang)) {
                        lang = localeConf.defaultLocale;
                    }
                }
            } else {
                lang = localeConf.defaultLocale;
            }

            if (lang !== currentLocale) {
                bundles = {};
                deferrences = {};
                currentLocale = lang;

                $rootScope.$broadcast(localeEvents.localeChanges, currentLocale);
                $rootScope.$broadcast(localeEvents.resourceUpdates);

                if (cookieStore) {
                    cookieStore.put(localeConf.cookieName, lang);
                }
            }
        }

        function getLocale() {
            return currentLocale;
        }

        setLocale(cookieStore ? cookieStore.get(localeConf.cookieName) : $window.navigator.userLanguage || $window.navigator.language);

        return {
            ready: ready,
            isToken: isToken,
            getPath: getPath,
            getKey: getKey,
            setLocale: setLocale,
            getLocale: getLocale,
            getString: getLocalizedString
        };
    }]);

angular.module('ngLocalize')
    .filter('i18n', ["locale", function (locale) {
        var i18nFilter = function (input, args) {
            return locale.getString(input, args);
        };

        i18nFilter.$stateful = true;

        return i18nFilter;
    }]);

angular.module('ngLocalize.Events', [])
    .constant('localeEvents', {
        resourceUpdates: 'ngLocalizeResourcesUpdated',
        localeChanges: 'ngLocalizeLocaleChanged'
    });
angular.module('ngLocalize')
    .directive('i18n', ["$sce", "locale", "localeEvents", "localeConf", function ($sce, locale, localeEvents, localeConf) {
        function setText(elm, tag) {
            if (tag !== elm.html()) {
                elm.html($sce.getTrustedHtml(tag));
            }
        }

        function update(elm, string, optArgs) {
            if (locale.isToken(string)) {
                locale.ready(locale.getPath(string)).then(function () {
                    setText(elm, locale.getString(string, optArgs));
                });
            } else {
                setText(elm, string);
            }
        }

        return function (scope, elm, attrs) {
            var hasObservers;

            attrs.$observe('i18n', function (newVal, oldVal) {
                if (newVal && newVal !== oldVal) {
                    update(elm, newVal, hasObservers); 
                }
            });

            angular.forEach(attrs.$attr, function (attr, normAttr) {
                if (localeConf.observableAttrs.test(attr)) {
                    attrs.$observe(normAttr, function (newVal) {
                        if (newVal || !hasObservers || !hasObservers[normAttr]) {
                            hasObservers = hasObservers || {};
                            hasObservers[normAttr] = attrs[normAttr];
                            update(elm, attrs.i18n, hasObservers);
                        }
                    });
                }
            });

            scope.$on(localeEvents.resourceUpdates, function () {
                update(elm, attrs.i18n, hasObservers);
            });
            scope.$on(localeEvents.localeChanges, function () {
                update(elm, attrs.i18n, hasObservers);
            });
        };
    }])
    .directive('i18nAttr', ["locale", "localeEvents", function (locale, localeEvents) {
        return function (scope, elem, attrs) {
            var lastValues = {};

            function updateText(target, attributes) {
                var values = scope.$eval(attributes),
                    langFiles = [],
                    exp;

                for(var key in values) {
                    exp = values[key];
                    if (locale.isToken(exp) && langFiles.indexOf(locale.getPath(exp)) === -1) {
                        langFiles.push(locale.getPath(exp));
                    }
                }

                locale.ready(langFiles).then(function () {
                    var value = '';

                    for(var key in values) {
                        exp = values[key];
                        value = locale.getString(exp);
                        if (lastValues[key] !== value) {
                            attrs.$set(key, lastValues[key] = value);
                        }
                    }
                });
            }

            attrs.$observe('i18nAttr', function (newVal) {
                if (newVal) {
                    updateText(elem, newVal); 
                }
            });

            scope.$on(localeEvents.resourceUpdates, function () {
                updateText(elem, attrs.i18nAttr);
            });
            scope.$on(localeEvents.localeChanges, function () {
                updateText(elem, attrs.i18nAttr);
            });
        };
    }]);

angular.module('ngLocalize.Config', [])
    .value('localeConf', {
        basePath: 'languages',
        defaultLocale: 'en-US',
        sharedDictionary: 'common',
        fileExtension: '.lang.json',
        persistSelection: true,
        cookieName: 'COOKIE_LOCALE_LANG',
        observableAttrs: new RegExp('^data-(?!ng-|i18n)'),
        delimiter: '::'
    });
}(this.angular, this, this.document));

/*global angular */
/*
 jQuery UI Datepicker plugin wrapper

 @note If ≤ IE8 make sure you have a polyfill for Date.toISOString()
 @param [ui-date] {object} Options to pass to $.fn.datepicker() merged onto uiDateConfig
 */

angular.module('ui.date', [])

.constant('uiDateConfig', {})

.directive('uiDate', ['uiDateConfig', 'uiDateConverter', function (uiDateConfig, uiDateConverter) {
  'use strict';
  var options;
  options = {};
  angular.extend(options, uiDateConfig);
  return {
    require:'?ngModel',
    link:function (scope, element, attrs, controller) {
      var getOptions = function () {
        return angular.extend({}, uiDateConfig, scope.$eval(attrs.uiDate));
      };
      var initDateWidget = function () {
        var showing = false;
        var opts = getOptions();

        function setVal() {
          var keys = ['Hours', 'Minutes', 'Seconds', 'Milliseconds'],
              isDate = angular.isDate(controller.$modelValue),
              preserve = {};

          if (isDate) {
            angular.forEach(keys, function(key) {
              preserve[key] = controller.$modelValue['get' + key]();
            });
          }
          controller.$setViewValue(element.datepicker('getDate'));

          if (isDate) {
            angular.forEach(keys, function(key) {
               controller.$viewValue['set' + key](preserve[key]);
            });
          }
        }

        // If we have a controller (i.e. ngModelController) then wire it up
        if (controller) {

          // Set the view value in a $apply block when users selects
          // (calling directive user's function too if provided)
          var _onSelect = opts.onSelect || angular.noop;
          opts.onSelect = function (value, picker) {
            scope.$apply(function() {
              showing = true;
              setVal();
              _onSelect(value, picker);
              element.blur();
            });
          };

          var _beforeShow = opts.beforeShow || angular.noop;
          opts.beforeShow = function(input, picker) {
            showing = true;
            _beforeShow(input, picker);
          };

          var _onClose = opts.onClose || angular.noop;
          opts.onClose = function(value, picker) {
            showing = false;
            _onClose(value, picker);
          };
          element.off('blur.datepicker').on('blur.datepicker', function() {
            if ( !showing ) {
              scope.$apply(function() {
                element.datepicker('setDate', element.datepicker('getDate'));
                setVal();
              });
            }
          });

          // Update the date picker when the model changes
          controller.$render = function () {
            var date = controller.$modelValue;
            if ( angular.isDefined(date) && date !== null && !angular.isDate(date) ) {
                if ( angular.isString(controller.$modelValue) ) {
                    date = uiDateConverter.stringToDate(attrs.uiDateFormat, controller.$modelValue);
                } else {
                    throw new Error('ng-Model value must be a Date, or a String object with a date formatter - currently it is a ' + typeof date + ' - use ui-date-format to convert it from a string');
                }
            }
            element.datepicker('setDate', date);
          };
        }
        // Check if the element already has a datepicker.
        if (element.data('datepicker')) {
            // Updates the datepicker options
            element.datepicker('option', opts);
            element.datepicker('refresh');
        } else {
            // Creates the new datepicker widget
            element.datepicker(opts);

            //Cleanup on destroy, prevent memory leaking
            element.on('$destroy', function () {
               element.datepicker('destroy');
            });
        }

        if ( controller ) {
          // Force a render to override whatever is in the input text box
          controller.$render();
        }
      };
      // Watch for changes to the directives options
      scope.$watch(getOptions, initDateWidget, true);
    }
  };
}
])
.factory('uiDateConverter', ['uiDateFormatConfig', function(uiDateFormatConfig){
    'use strict';
    function dateToString(dateFormat, value){
        dateFormat = dateFormat || uiDateFormatConfig;
        if (value) {
            if (dateFormat) {
                return jQuery.datepicker.formatDate(dateFormat, value);
            }

            if (value.toISOString) {
                return value.toISOString();
            }
        }
        return null;
    }

    function stringToDate(dateFormat, value) {
        dateFormat = dateFormat || uiDateFormatConfig;
        if ( angular.isString(value) ) {
            if (dateFormat) {
                return jQuery.datepicker.parseDate(dateFormat, value);
            }

            var isoDate = new Date(value);
            return isNaN(isoDate.getTime()) ? null : isoDate;
        }
        return null;
    }

    return {
        stringToDate: stringToDate,
        dateToString: dateToString
    };

}])
.constant('uiDateFormatConfig', '')
.directive('uiDateFormat', ['uiDateConverter', function(uiDateConverter) {
 'use strict';
  var directive = {
    require:'ngModel',
    link: function(scope, element, attrs, modelCtrl) {
        var dateFormat = attrs.uiDateFormat;

        // Use the datepicker with the attribute value as the dateFormat string to convert to and from a string
        modelCtrl.$formatters.unshift(function(value) {
            return uiDateConverter.stringToDate(dateFormat, value);
        });

        modelCtrl.$parsers.push(function(value){
            return uiDateConverter.dateToString(dateFormat, value);
        });

    }
  };

  return directive;
}]);

(function(e){"use strict";function t(e){return parseInt(e.replace(/px|%/,""),10)}e.module("scrollable-table",[]).directive("scrollableTable",["$timeout","$q","$parse",function(n,r,i){return{transclude:true,restrict:"E",scope:{rows:"=watch",sortFn:"="},template:'<div class="scrollableContainer">'+'<div class="headerSpacer"></div>'+'<div class="scrollArea" ng-transclude></div>'+"</div>",controller:["$scope","$element","$attrs",function(s,o,u){function a(e,t){var n=s.sortExpr.match(/(.+)\s+as\s+(.+)/);var r={};r[n[1]]=e;var o=i(n[2])(r);r[n[1]]=t;var u=i(n[2])(r);if(o===u)return 0;return o>u?1:-1}function f(e){var t=o.find(".headerSpacer").height();var n=o.find(".scrollArea").scrollTop();o.find(".scrollArea").scrollTop(n+e.position().top-t)}function l(){function t(){if(o.find("table:visible").length===0){n(t,100)}else{e.resolve()}}var e=r.defer();n(t);return e.promise}function h(){if(!o.find("thead th .th-inner").length){o.find("thead th").wrapInner('<div class="th-inner"></div>')}if(o.find("thead th .th-inner:not(:has(.box))").length){o.find("thead th .th-inner:not(:has(.box))").wrapInner('<div class="box"></div>')}o.find("table th .th-inner:visible").each(function(n,r){r=e.element(r);var i=r.parent().width(),s=o.find("table th:visible:last"),u=i;if(s.css("text-align")!=="center"){var a=o.find(".scrollArea").height()<o.find("table").height();if(s[0]==r.parent()[0]&&a){u+=o.find(".scrollArea").width()-o.find("tbody tr").width();u=Math.max(u,i)}}var f=t(r.parent().css("min-width")),l=r.parent().attr("title");u=Math.max(f,u);r.css("width",u);if(!l){l=r.find(".title .ng-scope").html()||r.find(".box").html()}r.attr("title",l.trim())});c.resolve()}function p(){var e=l().then(h),t=s.headerResizeHanlers||[];for(var n=0;n<t.length;n++){e=e.then(t[n])}return e}this.getSortExpr=function(){return s.sortExpr};this.isAsc=function(){return s.asc};this.setSortExpr=function(e){s.asc=true;s.sortExpr=e};this.toggleSort=function(){s.asc=!s.asc};this.doSort=function(e){if(e){s.rows.sort(function(t,n){var r=e(t,n);return s.asc?r:r*-1})}else{s.rows.sort(function(e,t){var n=a(e,t);return s.asc?n:n*-1})}};this.renderTalble=function(){return l().then(h)};this.getTableElement=function(){return o};this.appendTableResizingHandler=function(e){var t=s.headerResizeHanlers||[];for(var n=0;n<t.length;n++){if(t[n].name===e.name){return}}t.push(e);s.headerResizeHanlers=t};s.$on("rowSelected",function(e,t){var n=o.find(".scrollArea table tr[row-id='"+t+"']");if(n.length===1){r.all([l(),c.promise]).then(function(){f(n)})}});var c=r.defer();s.$watch("rows",function(e,t){if(e){p(o.find(".scrollArea").width());s.sortExpr=null;o.find(".scrollArea").scrollTop(0)}});s.asc=!u.hasOwnProperty("desc");s.sortAttr=u.sortAttr;o.find(".scrollArea").scroll(function(e){o.find("thead th .th-inner").css("margin-left",0-e.target.scrollLeft)});s.$on("renderScrollableTable",function(){p(o.find(".scrollArea").width())});e.element(window).on("resize",function(){s.$apply()});s.$watch(function(){return o.find(".scrollArea").width()},function(e,t){if(e*t<=0){return}p()})}]}}]).directive("sortableHeader",[function(){return{transclude:true,scope:true,require:"^scrollableTable",template:'<div class="box">'+'<div ng-mouseenter="enter()" ng-mouseleave="leave()">'+'<div class="title" ng-transclude></div>'+'<span class="orderWrapper">'+'<span class="order" ng-show="focused || isActive()" '+'ng-click="toggleSort($event)" ng-class="{active:isActive()}">'+'<i ng-show="isAscending()" class="glyphicon glyphicon-chevron-up"></i>'+'<i ng-show="!isAscending()" class="glyphicon glyphicon-chevron-down"></i>'+"</span>"+"</span>"+"</div>"+"</div>",link:function(t,n,r,i){var s=r.on||"a as a."+r.col;t.element=e.element(n);t.isActive=function(){return i.getSortExpr()===s};t.toggleSort=function(e){if(t.isActive()){i.toggleSort()}else{i.setSortExpr(s)}i.doSort(t[r.comparatorFn]);e.preventDefault()};t.isAscending=function(){if(t.focused&&!t.isActive()){return true}else{return i.isAsc()}};t.enter=function(){t.focused=true};t.leave=function(){t.focused=false};t.isLastCol=function(){return n.parent().find("th:last-child").get(0)===n.get(0)}}}}]).directive("resizable",["$compile",function(n){return{restrict:"A",priority:0,require:"^scrollableTable",link:function(i,s,o,u){function a(){var t=s.find("table th .th-inner");if(t.find(".resize-rod").length==0){u.getTableElement().find(".scrollArea table").css("table-layout","auto");var r=e.element('<div class="resize-rod" ng-mousedown="resizing($event)"></div>');t.append(n(r)(i))}}function f(){var n=u.getTableElement();var r=1;n.find("table th .th-inner:visible").each(function(n,i){i=e.element(i);var s=i.parent().width(),o=t(i.parent().css("min-width"));s=Math.max(o,s);i.css("left",r);r+=s})}function l(){var n=1,r=u.getTableElement();u.getTableElement().find("table th .th-inner:visible").each(function(i,s){s=e.element(s);var o=s.parent().width(),u=r.find("table th:visible:last"),a=t(s.parent().css("min-width"));o=Math.max(a,o);if(u[0]!=s.parent()[0]){s.parent().css("width",o)}s.css("left",n);n+=o})}function c(n){var r=u.getTableElement(),i=r.find("table th:visible").length,s=r.find("table th:visible:last");r.find("table th:visible").each(function(r,o){o=e.element(o);if(s.get(0)==o.get(0)){o.css("width","auto");return}var u=o.data("width");if(/\d+%$/.test(u)){u=Math.ceil(n*t(u)/100)}else{u=n/i}o.css("width",u+"px")});u.renderTalble().then(l())}u.appendTableResizingHandler(function(){a()});u.appendTableResizingHandler(function(){var t=u.getTableElement().find(".scrollArea table");if(t.css("table-layout")==="auto"){f()}else{c(t.parent().width())}});i.resizing=function(n){var r=u.getTableElement().find(".scrollArea").scrollLeft(),i=e.element(n.target).parent(),s=i.parent(),o=t(i.css("left"))+i.width()-r,a=n.pageX,f=e.element(document),c=e.element("body"),h=e.element(".scrollableContainer .resizing-cover"),p=e.element('<div class="scaler">');c.addClass("scrollable-resizing");h.addClass("active");e.element(".scrollableContainer").append(p);p.css("left",o);f.bind("mousemove",function(e){var n=e.pageX-a,r=t(p.css("left"))-o,i=s.width(),u=t(s.css("min-width")),f=s.next().width(),l=t(s.next().css("min-width"));a=e.pageX;e.preventDefault();if(n>0&&f-r<=l||n<0&&i+r<=u){return}p.css("left",t(p.css("left"))+n)});f.bind("mouseup",function(n){n.preventDefault();p.remove();c.removeClass("scrollable-resizing");h.removeClass("active");f.unbind("mousemove");f.unbind("mouseup");var r=t(p.css("left"))-o,i=s.width(),a=t(s.css("min-width")),d=s.next().width(),v=t(s.next().css("min-width")),m=u.getTableElement().find(".scrollArea table");if(m.css("table-layout")==="auto"){m.find("th .th-inner").each(function(t,n){n=e.element(n);var r=n.parent().width();n.parent().css("width",r)})}m.css("table-layout","fixed");if(r>0&&d-r<=v){r=d-v}s.next().removeAttr("style");i+=r;s.css("width",Math.max(a,i));s.next().css("width",d-r);u.renderTalble().then(l())})}}}}])})(angular)
/** 
* @license ng-prettyjson - v0.1.8
* (c) 2013 Julien VALERY https://github.com/darul75/ng-prettyjson
* License: MIT 
**/
!function(a){"use strict";a.module("ngPrettyJson",[]).directive("prettyJson",["$compile","$templateCache","ngPrettyJsonFunctions",function(b,c,d){var e=a.isDefined;return{restrict:"AE",scope:{json:"=",prettyJson:"=",onEdit:"&"},template:"<div></div>",replace:!0,link:function(f,g,h){var i={},j=null;f.id=h.id||"prettyjson",f.editActivated=!1,f.edition=h.edition,f.aceEditor=void 0!==window.ace;// compile template
var k=b(c.get("ng-prettyjson/ng-prettyjson-panel.tmpl.html"))(f,function(a,b){b.tmplElt=a});g.removeAttr("id"),g.append(k);// prefer the "json" attribute over the "prettyJson" one.
// the value on the scope might not be defined yet, so look at the markup.
var l,m=e(h.json)?"json":"prettyJson",n=function(a){var b=d.syntaxHighlight(a)||"";return b=b.replace(/\{/g,"<span class='sep'>{</span>").replace(/\}/g,"<span class='sep'>}</span>").replace(/\[/g,"<span class='sep'>[</span>").replace(/\]/g,"<span class='sep'>]</span>").replace(/\,/g,"<span class='sep'>,</span>"),e(a)?f.tmplElt.find("pre").html(b):f.tmplElt.find("pre").empty()};l=f.$watch(m,function(b){// BACKWARDS COMPATIBILITY:
// if newValue is an object, and we find a `json` property,
// then stop watching on `exp`.
a.isObject(b)&&e(b.json)?(l(),f.$watch(m+".json",function(a){f.editActivated||n(a),i=a},!0)):(f.editActivated||n(b),i=b),j&&(j.removeListener("change",o),j.setValue(JSON.stringify(b,null,"	")),j.on("change",o),j.resize())},!0);var o=function(){try{i=JSON.parse(j.getValue()),f.parsable=!0}catch(a){f.parsable=!1}// trigger update
f.$apply(function(){})};f.edit=function(){return f.aceEditor?(f.editActivated?(j&&(document.getElementById(f.id).env=null),n(i)):(j=ace.edit(f.id),j.setAutoScrollEditorIntoView(!0),j.setOptions({maxLines:1/0}),j.on("change",o),j.getSession().setMode("ace/mode/json")),void(f.editActivated=!f.editActivated)):void(console&&console.log("'ace lib is missing'"))},f.update=function(){f[m]=i,f.$emit("json-updated",i),f.onEdit&&f.onEdit({newJson:i}),this.edit()}}}}]).factory("ngPrettyJsonFunctions",function(){// cache some regular expressions
var b={entities:/((&)|(<)|(>))/g,json:/"(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|(null))\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g},c=["&amp;","&lt;","&gt;"],d=["number","string","key","boolean","null"],e=function(){var a=arguments.length-2;do a--;while(!arguments[a]);return a},f=function(a){var b;// the final two arguments are the length, and the entire string itself;
// we don't care about those.
if(arguments.length<7)throw new Error("markup() must be called from String.prototype.replace()");return b=e.apply(null,arguments),'<span class="'+d[b]+'">'+a+"</span>"},g=function(){var a;if(arguments.length<5)throw new Error("makeEntities() must be called from String.prototype.replace()");return a=e.apply(null,arguments),c[a-2]},h=function(c){return a.isString(c)||(c=JSON.stringify(c,null,2)),a.isDefined(c)?c.replace(b.entities,g).replace(b.json,f):void 0};return{syntaxHighlight:h,makeEntities:g,markup:f,rx:b}})}(window.angular),function(a){"use strict";a.module("ngPrettyJson").run(["$templateCache",function(a){a.put("ng-prettyjson/ng-prettyjson-panel.tmpl.html",'<div><button ng-click="edit()" ng-show="edition && !editActivated">Edit</button><button ng-click="edit()" ng-show="edition && editActivated">Cancel</button><button ng-click="update()" ng-show="editActivated && parsable">Update</button><pre class="pretty-json" id="{{id}}"></pre></div>')}])}(window.angular);
(function(b){b.widget("ui.tagit",{options:{allowDuplicates:!1,caseSensitive:!0,fieldName:"tags",placeholderText:null,readOnly:!1,removeConfirmation:!1,tagLimit:null,availableTags:[],autocomplete:{},showAutocompleteOnFocus:!1,allowSpaces:!1,singleField:!1,singleFieldDelimiter:",",singleFieldNode:null,animate:!0,tabIndex:null,beforeTagAdded:null,afterTagAdded:null,beforeTagRemoved:null,afterTagRemoved:null,onTagClicked:null,onTagLimitExceeded:null,onTagAdded:null,onTagRemoved:null,tagSource:null},_create:function(){var a=
this;this.element.is("input")?(this.tagList=b("<ul></ul>").insertAfter(this.element),this.options.singleField=!0,this.options.singleFieldNode=this.element,this.element.addClass("tagit-hidden-field")):this.tagList=this.element.find("ul, ol").andSelf().last();this.tagInput=b('<input type="text" />').addClass("ui-widget-content");this.options.readOnly&&this.tagInput.attr("disabled","disabled");this.options.tabIndex&&this.tagInput.attr("tabindex",this.options.tabIndex);this.options.placeholderText&&this.tagInput.attr("placeholder",
this.options.placeholderText);this.options.autocomplete.source||(this.options.autocomplete.source=function(a,e){var d=a.term.toLowerCase(),c=b.grep(this.options.availableTags,function(a){return 0===a.toLowerCase().indexOf(d)});this.options.allowDuplicates||(c=this._subtractArray(c,this.assignedTags()));e(c)});this.options.showAutocompleteOnFocus&&(this.tagInput.focus(function(b,d){a._showAutocomplete()}),"undefined"===typeof this.options.autocomplete.minLength&&(this.options.autocomplete.minLength=
0));b.isFunction(this.options.autocomplete.source)&&(this.options.autocomplete.source=b.proxy(this.options.autocomplete.source,this));b.isFunction(this.options.tagSource)&&(this.options.tagSource=b.proxy(this.options.tagSource,this));this.tagList.addClass("tagit").addClass("ui-widget ui-widget-content ui-corner-all").append(b('<li class="tagit-new"></li>').append(this.tagInput)).click(function(d){var c=b(d.target);c.hasClass("tagit-label")?(c=c.closest(".tagit-choice"),c.hasClass("removed")||a._trigger("onTagClicked",
d,{tag:c,tagLabel:a.tagLabel(c)})):a.tagInput.focus()});var c=!1;if(this.options.singleField)if(this.options.singleFieldNode){var d=b(this.options.singleFieldNode),f=d.val().split(this.options.singleFieldDelimiter);d.val("");b.each(f,function(b,d){a.createTag(d,null,!0);c=!0})}else this.options.singleFieldNode=b('<input type="hidden" style="display:none;" value="" name="'+this.options.fieldName+'" />'),this.tagList.after(this.options.singleFieldNode);c||this.tagList.children("li").each(function(){b(this).hasClass("tagit-new")||
(a.createTag(b(this).text(),b(this).attr("class"),!0),b(this).remove())});this.tagInput.keydown(function(c){if(c.which==b.ui.keyCode.BACKSPACE&&""===a.tagInput.val()){var d=a._lastTag();!a.options.removeConfirmation||d.hasClass("remove")?a.removeTag(d):a.options.removeConfirmation&&d.addClass("remove ui-state-highlight")}else a.options.removeConfirmation&&a._lastTag().removeClass("remove ui-state-highlight");if(c.which===b.ui.keyCode.COMMA&&!1===c.shiftKey||c.which===b.ui.keyCode.ENTER||c.which==
b.ui.keyCode.TAB&&""!==a.tagInput.val()||c.which==b.ui.keyCode.SPACE&&!0!==a.options.allowSpaces&&('"'!=b.trim(a.tagInput.val()).replace(/^s*/,"").charAt(0)||'"'==b.trim(a.tagInput.val()).charAt(0)&&'"'==b.trim(a.tagInput.val()).charAt(b.trim(a.tagInput.val()).length-1)&&0!==b.trim(a.tagInput.val()).length-1))c.which===b.ui.keyCode.ENTER&&""===a.tagInput.val()||c.preventDefault(),a.options.autocomplete.autoFocus&&a.tagInput.data("autocomplete-open")||(a.tagInput.autocomplete("close"),a.createTag(a._cleanedInput()))}).blur(function(b){a.tagInput.data("autocomplete-open")||
a.createTag(a._cleanedInput())});if(this.options.availableTags||this.options.tagSource||this.options.autocomplete.source)d={select:function(b,c){a.createTag(c.item.value);return!1}},b.extend(d,this.options.autocomplete),d.source=this.options.tagSource||d.source,this.tagInput.autocomplete(d).bind("autocompleteopen.tagit",function(b,c){a.tagInput.data("autocomplete-open",!0)}).bind("autocompleteclose.tagit",function(b,c){a.tagInput.data("autocomplete-open",!1)}),this.tagInput.autocomplete("widget").addClass("tagit-autocomplete")},
destroy:function(){b.Widget.prototype.destroy.call(this);this.element.unbind(".tagit");this.tagList.unbind(".tagit");this.tagInput.removeData("autocomplete-open");this.tagList.removeClass("tagit ui-widget ui-widget-content ui-corner-all tagit-hidden-field");this.element.is("input")?(this.element.removeClass("tagit-hidden-field"),this.tagList.remove()):(this.element.children("li").each(function(){b(this).hasClass("tagit-new")?b(this).remove():(b(this).removeClass("tagit-choice ui-widget-content ui-state-default ui-state-highlight ui-corner-all remove tagit-choice-editable tagit-choice-read-only"),
b(this).text(b(this).children(".tagit-label").text()))}),this.singleFieldNode&&this.singleFieldNode.remove());return this},_cleanedInput:function(){return b.trim(this.tagInput.val().replace(/^"(.*)"$/,"$1"))},_lastTag:function(){return this.tagList.find(".tagit-choice:last:not(.removed)")},_tags:function(){return this.tagList.find(".tagit-choice:not(.removed)")},assignedTags:function(){var a=this,c=[];this.options.singleField?(c=b(this.options.singleFieldNode).val().split(this.options.singleFieldDelimiter),
""===c[0]&&(c=[])):this._tags().each(function(){c.push(a.tagLabel(this))});return c},_updateSingleTagsField:function(a){b(this.options.singleFieldNode).val(a.join(this.options.singleFieldDelimiter)).trigger("change")},_subtractArray:function(a,c){for(var d=[],f=0;f<a.length;f++)-1==b.inArray(a[f],c)&&d.push(a[f]);return d},tagLabel:function(a){return this.options.singleField?b(a).find(".tagit-label:first").text():b(a).find("input:first").val()},_showAutocomplete:function(){this.tagInput.autocomplete("search",
"")},_findTagByLabel:function(a){var c=this,d=null;this._tags().each(function(f){if(c._formatStr(a)==c._formatStr(c.tagLabel(this)))return d=b(this),!1});return d},_isNew:function(a){return!this._findTagByLabel(a)},_formatStr:function(a){return this.options.caseSensitive?a:b.trim(a.toLowerCase())},_effectExists:function(a){return Boolean(b.effects&&(b.effects[a]||b.effects.effect&&b.effects.effect[a]))},createTag:function(a,c,d){var f=this;a=b.trim(a);this.options.preprocessTag&&(a=this.options.preprocessTag(a));
if(""===a)return!1;if(!this.options.allowDuplicates&&!this._isNew(a))return a=this._findTagByLabel(a),!1!==this._trigger("onTagExists",null,{existingTag:a,duringInitialization:d})&&this._effectExists("highlight")&&a.effect("highlight"),!1;if(this.options.tagLimit&&this._tags().length>=this.options.tagLimit)return this._trigger("onTagLimitExceeded",null,{duringInitialization:d}),!1;var g=b(this.options.onTagClicked?'<a class="tagit-label"></a>':'<span class="tagit-label"></span>').text(a),e=b("<li></li>").addClass("tagit-choice ui-widget-content ui-state-default ui-corner-all").addClass(c).append(g);
this.options.readOnly?e.addClass("tagit-choice-read-only"):(e.addClass("tagit-choice-editable"),c=b("<span></span>").addClass("ui-icon ui-icon-close"),c=b('<a><span class="text-icon">\u00d7</span></a>').addClass("tagit-close").append(c).click(function(a){f.removeTag(e)}),e.append(c));this.options.singleField||(g=g.html(),e.append('<input type="hidden" value="'+g+'" name="'+this.options.fieldName+'" class="tagit-hidden-field" />'));!1!==this._trigger("beforeTagAdded",null,{tag:e,tagLabel:this.tagLabel(e),
duringInitialization:d})&&(this.options.singleField&&(g=this.assignedTags(),g.push(a),this._updateSingleTagsField(g)),this._trigger("onTagAdded",null,e),this.tagInput.val(""),this.tagInput.parent().before(e),this._trigger("afterTagAdded",null,{tag:e,tagLabel:this.tagLabel(e),duringInitialization:d}),this.options.showAutocompleteOnFocus&&!d&&setTimeout(function(){f._showAutocomplete()},0))},removeTag:function(a,c){c="undefined"===typeof c?this.options.animate:c;a=b(a);this._trigger("onTagRemoved",
null,a);if(!1!==this._trigger("beforeTagRemoved",null,{tag:a,tagLabel:this.tagLabel(a)})){if(this.options.singleField){var d=this.assignedTags(),f=this.tagLabel(a),d=b.grep(d,function(a){return a!=f});this._updateSingleTagsField(d)}if(c){a.addClass("removed");var d=this._effectExists("blind")?["blind",{direction:"horizontal"},"fast"]:["fast"],g=this;d.push(function(){a.remove();g._trigger("afterTagRemoved",null,{tag:a,tagLabel:g.tagLabel(a)})});a.fadeOut("fast").hide.apply(a,d).dequeue()}else a.remove(),
this._trigger("afterTagRemoved",null,{tag:a,tagLabel:this.tagLabel(a)})}},removeTagByLabel:function(a,b){var d=this._findTagByLabel(a);if(!d)throw"No such tag exists with the name '"+a+"'";this.removeTag(d,b)},removeAll:function(){var a=this;this._tags().each(function(b,d){a.removeTag(d,!1)})}})})(jQuery);

/*! Idle Timer v1.0.1 2014-03-21 | https://github.com/thorst/jquery-idletimer | (c) 2014 Paul Irish | Licensed MIT */
!function(a){a.idleTimer=function(b,c){var d;"object"==typeof b?(d=b,b=null):"number"==typeof b&&(d={timeout:b},b=null),c=c||document,d=a.extend({idle:!1,timeout:3e4,events:"mousemove keydown wheel DOMMouseScroll mousewheel mousedown touchstart touchmove MSPointerDown MSPointerMove"},d);var e=a(c),f=e.data("idleTimerObj")||{},g=function(b){var d=a.data(c,"idleTimerObj")||{};d.idle=!d.idle,d.olddate=+new Date;var e=a.Event((d.idle?"idle":"active")+".idleTimer");a(c).trigger(e,[c,a.extend({},d),b])},h=function(b){var d=a.data(c,"idleTimerObj")||{};if(null==d.remaining){if("mousemove"===b.type){if(b.pageX===d.pageX&&b.pageY===d.pageY)return;if("undefined"==typeof b.pageX&&"undefined"==typeof b.pageY)return;var e=+new Date-d.olddate;if(200>e)return}clearTimeout(d.tId),d.idle&&g(b),d.lastActive=+new Date,d.pageX=b.pageX,d.pageY=b.pageY,d.tId=setTimeout(g,d.timeout)}},i=function(){var b=a.data(c,"idleTimerObj")||{};b.idle=b.idleBackup,b.olddate=+new Date,b.lastActive=b.olddate,b.remaining=null,clearTimeout(b.tId),b.idle||(b.tId=setTimeout(g,b.timeout))},j=function(){var b=a.data(c,"idleTimerObj")||{};null==b.remaining&&(b.remaining=b.timeout-(+new Date-b.olddate),clearTimeout(b.tId))},k=function(){var b=a.data(c,"idleTimerObj")||{};null!=b.remaining&&(b.idle||(b.tId=setTimeout(g,b.remaining)),b.remaining=null)},l=function(){var b=a.data(c,"idleTimerObj")||{};clearTimeout(b.tId),e.removeData("idleTimerObj"),e.off("._idleTimer")},m=function(){var b=a.data(c,"idleTimerObj")||{};if(b.idle)return 0;if(null!=b.remaining)return b.remaining;var d=b.timeout-(+new Date-b.lastActive);return 0>d&&(d=0),d};if(null===b&&"undefined"!=typeof f.idle)return i(),e;if(null===b);else{if(null!==b&&"undefined"==typeof f.idle)return!1;if("destroy"===b)return l(),e;if("pause"===b)return j(),e;if("resume"===b)return k(),e;if("reset"===b)return i(),e;if("getRemainingTime"===b)return m();if("getElapsedTime"===b)return+new Date-f.olddate;if("getLastActiveTime"===b)return f.lastActive;if("isIdle"===b)return f.idle}return e.on(a.trim((d.events+" ").split(" ").join("._idleTimer ")),function(a){h(a)}),f=a.extend({},{olddate:+new Date,lastActive:+new Date,idle:d.idle,idleBackup:d.idle,timeout:d.timeout,remaining:null,tId:null,pageX:null,pageY:null}),f.idle||(f.tId=setTimeout(g,f.timeout)),a.data(c,"idleTimerObj",f),e},a.fn.idleTimer=function(b){return this[0]?a.idleTimer(b,this[0]):this}}(jQuery);
//    var oneHour = 1 * 60 * 60 * 1000;
var session_timeout = {
    //Logout Settings
    inactiveTimeout: 1 * 58 * 60 * 1000,     //(ms) The time until we display a warning message
    warningTimeout: 60 * 1000,      //(ms) The time until we log them out
//    inactiveTimeout: 5 * 1000,     //(ms) The time until we display a warning message
//    warningTimeout: 10 * 1000,      //(ms) The time until we log them out
    minWarning: 60 * 1000,           //(ms) If they come back to page (on mobile), The minumum amount, before we just log them out
    warningStart: null,         //Date time the warning was started
    warningTimer: null,         //Timer running every second to countdown to logout
    logout: function () {       //Logout function once warningTimeout has expired
        'use strict';
        //window.location = settings.autologout.logouturl;
        jQuery(document).idleTimer("destroy");
        clearInterval(session_timeout.warningTimer);
        clearInterval(session_timeout.keepaliveTimer);
    },
    logout2: function () {       //Logout function once warningTimeout has expired
        'use strict';
        //window.location = settings.autologout.logouturl;
        jQuery(document).idleTimer("destroy");
        clearInterval(session_timeout.warningTimer);
        clearInterval(session_timeout.keepaliveTimer);
        window.location.reload();

    },
    login: function() {
        'use strict';
        jQuery(document).idleTimer(session_timeout.inactiveTimeout);
    },

//Keepalive Settings
keepaliveTimer: null,
keepaliveUrl: "",
keepaliveInterval: 5000,     //(ms) the interval to call said url
keepAlive: function () {
    //console.log("keep alive trigger");
    }
};

jQuery( document ).on( "idle.idleTimer", function(event, elem, obj){
    // function you want to fire when the user goes idle
    //Get time when user was last active
    'use strict';
    var diff = (+new Date()) - obj.lastActive - obj.timeout,
    warning = (+new Date()) - diff;
    if(diff <= 0)
    {
    diff = 0;
    }

//On mobile js is paused, so see if this was triggered while we were sleeping
if (diff >= session_timeout.warningTimeout || warning <= session_timeout.minWarning) {
    jQuery("#mdlLoggedOut").modal("show");
    } else {
    //Show dialog, and note the time
    jQuery('#sessionSecondsRemaining').html(Math.round((session_timeout.warningTimeout - diff) / 1000));
    jQuery("#myModal").modal("show");
    session_timeout.warningStart = (+new Date()) - diff;

    //Update counter downer every second
    session_timeout.warningTimer = setInterval(function () {
    var remaining = Math.round((session_timeout.warningTimeout / 1000) - (((+new Date()) - session_timeout.warningStart) / 1000));
    if (remaining >= 0) {
    jQuery('#sessionSecondsRemaining').html(remaining);
    } else {
        clearInterval(session_timeout.warningTimer);
        session_timeout.logout2();
    }
}, 1000);
}

});

// create a timer to keep server session alive, independent of idle timer

session_timeout.keepaliveTimer = setInterval(function () {
    'use strict';
    session_timeout.keepAlive();
}, session_timeout.keepaliveInterval);

var screen = '';
var global_redirect_url = '/';
$(document).ready(function () {
    'use strict';
    $(window).on('hashchange', function(e){
        var url = [];
        url.push(window.location.href);

    });

    $(".dropdown-menu").mouseout(function(){
        $(".dropdown-menu").hide();
    });

    if (typeof env !== 'undefined' && env === 'production') {
        window.intercomSettings = {
            app_id: intercom_id
        };
        (function () {
            var w = window;
            var ic = w.Intercom;
            console.log(ic);
            if (typeof ic === "function") {
                ic('reattach_activator');
                ic('update', intercomSettings);
            } else {
                var d = document;
                var i = function () {
                    i.c(arguments);
                };
                i.q = [];
                i.c = function (args) {
                    i.q.push(args);
                };
                w.Intercom = i;


                if (w.attachEvent) {
                    w.attachEvent('onload', l);
                } else {
                    w.addEventListener('load', l, false);
                }
            }
        })();

    }

    if ($(window).width() < 776) {
        screen = "mobile";
        $("#mobile").css({
            "display": ""
        });
        $("#desktop").css({
            "display": "none"
        });
        $(document.body).find('#login-container').removeClass('login-page');
    } else if ($(window).width() > 776) {
        screen="desktop";
        $("#mobile").css({
            "display": "none"
        });
        $("#desktop").css({
            "display": ""
        });
        $(document.body).find('#login-container').addClass("login-page");

    }

    $('#dashboard-menu').hide();

    //stick in the fixed 100% height behind the navbar but don't wrap it
    $('#navbar.navbar-inverse').after($('<div class="inverse" id="navbar-height-col"></div>'));

    $('#navbar.navbar-default').after($('<div id="navbar-height-col"></div>'));

    // Enter your ids or classes
    var toggler = '.navbar-toggle';
    var pagewrapper = '#page-content';
    var navigationwrapper = '.navbar-header';
    var menuwidth = '100%'; // the menu inside the slide menu itself
    var slidewidth = '80%';
    var menuneg = '-200%';
    var slideneg = '-80%';
    var isCollapse = false;


    $("#navbar").on("click", toggler, function (e) {

        var selected = $(this).hasClass('slide-active');

        $('#slidemenu').stop().animate({
            left: selected ? menuneg : '0px'
        });

        $('#navbar-height-col').stop().animate({
            left: selected ? slideneg : '0px'
        });

        $(pagewrapper).stop().animate({
            left: selected ? '0px' : slidewidth
        });

        $(navigationwrapper).stop().animate({
            left: selected ? '0px' : slidewidth
        });


        $(this).toggleClass('slide-active', !selected);
        $('#slidemenu').toggleClass('slide-active');


        $('#page-content, .navbar, body, .navbar-header').toggleClass('slide-active');


    });


    var selected = '#slidemenu, #page-content, body, .navbar, .navbar-header, .navbar-toggle';
    var selected2 = '.navbar-header, #slidemenu, #navbar-height-col, #page-content';

    //if ($(window).width() < 776 && screen === "desktop") {
    //    //Reload;
    //    display = "mobile";
    //}
    $(window).on("resize", function () {
        if ($(window).width() < 776 && screen ==="desktop") {
            this.location.reload(false);
            $("#mobile").css({
                "display": ""
            });
            $("#desktop").css({
                "display": "none"
            });
            $(".col-md-offset-4.col-md-5").removeClass("login-page");
            screen = "mobile";
        }else if($(window).width() > 776 && screen === "mobile"){
            this.location.reload(false);
            $("#mobile").css({
                "display": "none"
            });
            $("#desktop").css({
                "display": ""
            });
            $(".col-md-offset-4.col-md-5").addClass("login-page");
            screen = "desktop";
        }

        //if ($(window).width() < 776) {
        //
        //} else if ($(window).width() > 776) {
        //
        //
        //}

        if ($(window).width() > 990 && $(window).width() < 1600) {
            $("a#forgot_button").addClass("btn-block");
        } else {
            $("a#forgot_button").removeClass("btn-block");

        }

    });
    $('.collapse-icon').on("click", function () {
        if (isCollapse === false) {
            $('#slide-menu').removeAttr('class');
            $('#slide-menu').addClass('collapse-icon glyphicon glyphicon-menu-hamburger');
            $('.navbar').hide();
            $('#dashboard-menu').show();
            isCollapse = true;
        } else if (isCollapse === true) {
            isCollapse = false;
            $('#slide-menu').removeAttr('class');
            $('#slide-menu').addClass('collapse-icon glyphicon glyphicon-remove');
            $('.navbar').show();
            $('#dashboard-menu').hide();
        }
    });

    $('#school-history-close').on('click', function () {
        $('#academic').show();


    });

    $('#school-history-open').on('click', function () {

        $('#school-history').show();
    });
});

function hideContent(curr) {
    'use strict';
    jQuery(curr).parent().find('div.data-content').hide();
    jQuery(curr).parent().find('#content-help').hide();
    jQuery(curr).parent().find('.menu-up').hide();
    jQuery(curr).parent().find('.menu-down').show();
}

function showContent(curr) {
    'use strict';
    jQuery(curr).parent().find('div.data-content').show();
    jQuery(curr).parent().find('#content-help').show();
    jQuery(curr).parent().find('.menu-up').show();
    jQuery(curr).parent().find('.menu-down').hide();
}
function l() {
    'use strict';
    var s = d.createElement('script');
    s.type = 'text/javascript';
    s.async = true;
    s.src = 'https://widget.intercom.io/widget/m9w2ywgr';
    var x = d.getElementsByTagName('script')[0];
    x.parentNode.insertBefore(s, x);
}
/**
 * AngularJS fixed header scrollable table directive
 * @author Jason Watmore <jason@pointblankdevelopment.com.au> (http://jasonwatmore.com)
 * @version 1.2.0
 */
(function () {
    'use strict';
    angular
        .module('anguFixedHeaderTable', [])
        .directive('fixedHeader', fixedHeader);

    fixedHeader.$inject = ['$timeout'];

    function fixedHeader($timeout) {
        return {
            restrict: 'A',
            link: link
        };

        function link($scope, $elem, $attrs, $ctrl) {
            var elem = $elem[0];

            // wait for data to load and then transform the table
            $scope.$watch(tableDataLoaded, function(isTableDataLoaded) {
                if (isTableDataLoaded) {
                    transformTable();
                }
            });

            function tableDataLoaded() {
                // first cell in the tbody exists when data is loaded but doesn't have a width
                // until after the table is transformed
                var firstCell = elem.querySelector('tbody tr:first-child td:first-child');
                return firstCell && !firstCell.style.width;
            }

            function transformTable() {
                // reset display styles so column widths are correct when measured below
                angular.element(elem.querySelectorAll('thead, tbody, tfoot')).css('display', '');

                // wrap in $timeout to give table a chance to finish rendering
                $timeout(function () {
                    // set widths of columns
                    angular.forEach(elem.querySelectorAll('tr:first-child th'), function (thElem, i) {

                        var tdElems = elem.querySelector('tbody tr:first-child td:nth-child(' + (i + 1) + ')');
                        var tfElems = elem.querySelector('tfoot tr:first-child td:nth-child(' + (i + 1) + ')');

                        var columnWidth = tdElems ? tdElems.offsetWidth : thElem.offsetWidth;
                        if (tdElems) {
                            tdElems.style.width = columnWidth + 'px';
                        }
                        if (thElem) {
                            thElem.style.width = columnWidth + 'px';
                        }
                        if (tfElems) {
                            tfElems.style.width = columnWidth + 'px';
                        }
                    });

                    // set css styles on thead and tbody
                    angular.element(elem.querySelectorAll('thead, tfoot')).css('display', 'block');

                    angular.element(elem.querySelectorAll('tbody')).css({
                        'display': 'block',
                        'height': $attrs.tableHeight || 'inherit',
                        'overflow': 'auto'
                    });

                    // reduce width of last column by width of scrollbar
                    var tbody = elem.querySelector('tbody');
                    var scrollBarWidth = tbody.offsetWidth - tbody.clientWidth;
                    if (scrollBarWidth > 0) {
                        // for some reason trimming the width by 2px lines everything up better
                        scrollBarWidth -= 2;
                        var lastColumn = elem.querySelector('tbody tr:first-child td:last-child');
                        lastColumn.style.width = (lastColumn.offsetWidth - scrollBarWidth) + 'px';
                    }
                });
            }
        }
    }
})();
/*!
 * classie - class helper functions
 * from bonzo https://github.com/ded/bonzo
 * 
 * classie.has( elem, 'my-class' ) -> true/false
 * classie.add( elem, 'my-new-class' )
 * classie.remove( elem, 'my-unwanted-class' )
 * classie.toggle( elem, 'my-class' )
 */

/*jshint browser: true, strict: true, undef: true */

( function( window ) {

'use strict';

// class helper functions from bonzo https://github.com/ded/bonzo

function classReg( className ) {
  return new RegExp("(^|\\s+)" + className + "(\\s+|$)");
}

// classList support for class management
// altho to be fair, the api sucks because it won't accept multiple classes at once
var hasClass, addClass, removeClass;

if ( 'classList' in document.documentElement ) {
  hasClass = function( elem, c ) {
    return elem.classList.contains( c );
  };
  addClass = function( elem, c ) {
    elem.classList.add( c );
  };
  removeClass = function( elem, c ) {
    elem.classList.remove( c );
  };
}
else {
  hasClass = function( elem, c ) {
    return classReg( c ).test( elem.className );
  };
  addClass = function( elem, c ) {
    if ( !hasClass( elem, c ) ) {
      elem.className = elem.className + ' ' + c;
    }
  };
  removeClass = function( elem, c ) {
    elem.className = elem.className.replace( classReg( c ), ' ' );
  };
}

function toggleClass( elem, c ) {
  var fn = hasClass( elem, c ) ? removeClass : addClass;
  fn( elem, c );
}

window.classie = {
  // full names
  hasClass: hasClass,
  addClass: addClass,
  removeClass: removeClass,
  toggleClass: toggleClass,
  // short names
  has: hasClass,
  add: addClass,
  remove: removeClass,
  toggle: toggleClass
};

})( window );
$(document).ready(function () {
    'use strict';
    var status = 'open';
    var menuLeft = document.getElementById('cbp-spmenu-s1'),
        showLeftPush = document.getElementById('showLeftPush'),
        sidebarmenu = document.getElementById('collapse-sidebarmenu'),
        body = document.body;
    if (showLeftPush) {
        showLeftPush.onclick = function () {
            var icon = $("#showLeftPush").attr('class');
            classie.toggle(this, 'active');
            classie.toggle(body, 'cbp-spmenu-push-toright');
            classie.toggle(menuLeft, 'cbp-spmenu-open');
            if (icon === "glyphicon glyphicon-menu-hamburger") {
                $("#showLeftPush").attr('class', 'glyphicon glyphicon-remove');
            } else if (icon === "glyphicon glyphicon-remove") {
                $("#showLeftPush").attr('class', 'glyphicon glyphicon-menu-hamburger');
            }
        };
    }
    if (sidebarmenu) {
        sidebarmenu.onclick = function () {
            if (status === 'open') {
                $('#collapse-sidebarmenu').removeClass('glyphicon glyphicon-remove');
                $('#collapse-sidebarmenu').addClass('glyphicon glyphicon-menu-hamburger');
                $('.link-nav').css({
                    'display': 'none'
                });
                $('#border').css({
                    'display': 'none'
                });
                $('#desktop-nav').css({
                    'width': '3%'
                });
                $('#collapse-sidebarmenu').addClass('icon-collapse-menu');
                $('#center-panel').css({
                    'margin-left': '3%'
                });
                status = 'close';
                $('#footer').addClass('hide');
            } else if (status === 'close') {

                $('#collapse-sidebarmenu').removeClass('glyphicon glyphicon-menu-hamburger');
                $('#collapse-sidebarmenu').addClass('glyphicon glyphicon-remove');
                $('.link-nav').css({
                    'display': ''
                });
                $('#border').css({
                    'display': ''
                });
                $('#desktop-nav').css({
                    'width': '15%'
                });
                $('#desktop-nav').css({
                    'position': 'fixed'
                });
                $('#desktop-nav').css({
                    'height': '100%'
                });
                $('#collapse-sidebarmenu').removeClass('icon-collapse-menu');
                $('#collapse-sidebarmenu').addClass('icon-sidebarmenu');
                $('#center-panel').css({
                    'margin-left': '15%'
                });
                status = 'open';
                $('#footer').removeClass('hide');
            }

        };
    }
});

var auth_url = '';

var api_url = '';

var url = '';

var origin = window.location.origin;

const env = 'dev';

var __local = 'http://helpinghand.cbo.upward.st';

var intercom_id = 'bfu4q2i7';

var schoolDistricts = {
    'seattle': "Seattle",
    'highline': "Highline",
    'federalway': "Federal Way",
    'renton': 'Renton',
    'northshore': 'North Shore'
};
var relationships = {
    'parent': "Parent",
    'grandparent': "Grandparent",
    'aunt': "Aunt",
    'uncle': 'Uncle',
    'brother': 'Brother',
    'sister': 'Sister'
};


var globalConfig = {};
var config = {
    dev: {
        client_id: 'cbo_client_demo',
        client_secret: '7e98a24f4fe91535348f6e87cde866dca9134b50fc029abefdc7278369f2',
        response_type: 'code',
        grant_type: 'password'
    },
    production: {
        client_id: "studentsuccesslink.org",
        client_secret: "8cd0ac3761341570c1c0d4caaf2d36900a1c42bdb4474565c72fa5d37a52",
        response_type: "code",
        grant_type: "password"
    },
    staging: {
        client_id: 'sslstaging.studentsuccesslink.upward.st',
        client_secret: 'ed789e8077173fdaa3fa2430ffc0eec0aef43ac5519ee575aa8409a00195',
        response_type: 'code',
        grant_type: 'password'
    }
};

if (origin.indexOf("studentsuccesslink.org") > 0) {
    auth_url = "https://auth.studentsuccesslink.org/api/";
    api_url = "https://api.studentsuccesslink.org/";
    globalConfig = config.production;
} else if (origin.indexOf("studentsuccesslink.upward") > 0) {
    auth_url = "https://auth.sslstaging.studentsuccesslink.upward.st/api/";
    api_url = "https://api.sslstaging.studentsuccesslink.upward.st/";
    globalConfig = config.staging;
} else if (origin.indexOf("cbo.upward") > 0) {
    auth_url = "https://auth.cbo.upward.st/api/";
    api_url = "https://api.cbo.upward.st/";
    globalConfig = config.dev;
} else if (origin.indexOf("localhost") > 0) {
    auth_url = "https://auth.cbo.upward.st/api/";
    api_url = "https://api.cbo.upward.st/";
    globalConfig = config.dev;
}

var a = {
    "host": "cbo.upwardst.st",
    "api": {
        "url": "https://api.cbo.upward.st"
    },
    "auth": {
        "url": "https://auth.cbo.upward.st"
    },
    "token": {
        "expires_in": 3600
    },
    "db": {
        "mongo": {
            "host": "zaenal:zendev@ds037262.mongolab.com:37262",
            "name": "cbo"
        }
    },
    "session": {
        "secret": "cbo-2015",
        "saveUninitialized": true,
        "resave": true
    },

    "mandrill": {
        "api_key": "Hg8CvPdPtFMrwHVDbhTTEw"
    },
    "hzb": {
        "default": "xsre",
        "sre": {
            "url": "https://psesd.hostedzone.com/svcs/dev",
            "sessionToken": "be860c47-6bd5-4953-aac0-cd8f1ea6bc37",
            "sharedSecret": "zsdKbxbtUk23",
            "object": "sres",
            "service": "sres",
            "contextId": "CBO",
            "headers": {
                "serviceType": "OBJECT",
                "requestType": "IMMEDIATE",
                "requestAction": "QUERY",
                "messageType": "REQUEST",
                "objectType": "sre",
                "Accept": "application/xml",
                "Content-Type": "application/xml"
            },
            "validation-url": "http://p2cbo-dev-testsre.azurewebsites.net/api/v1",
            "validation-service": "validation-sre"
        },
        "xsre": {
//            "url": "https://psesd.hostedzone.com/svcs/dev",
	        "url": "http://mockhzb.upward.st/svcs/dev",
            "sessionToken": "be860c47-6bd5-4953-aac0-cd8f1ea6bc37",
            "sharedSecret": "zsdKbxbtUk23",
            "object": "xSres",
            "service": "xSres",
            "contextId": "CBO",
            "headers": {
                "serviceType": "OBJECT",
                "requestType": "IMMEDIATE",
                "requestAction": "QUERY",
                "messageType": "REQUEST",
                "objectType": "xSre",
                "Accept": "application/xml",
                "Content-Type": "application/xml"
            },
            "validation-url": "http://p2cbo-dev-testsre.azurewebsites.net/api/v1",
            "validation-service": "validation-sre"
        },
        "prs": {
            "url": "https://p2cbo-dev-prs.azurewebsites.net/api/v1",
            "sessionToken": "4127aa6b-2513-4069-9066-cb5c9a7be2af",
            "sharedSecret": "tqjYW8nXZ3KUPURJYjfQxmNg",
            "headers": {
                "Accept": "application/xml"
            },
            "validation-url": "",
            "validation-service": ""
        }
    },
    "cross": {
        "enable": true,
        /** default: "*" */
        "allow_origin": "*",
        "allow_headers": "Authorization, Origin, X-Requested-With, Content-Type, Accept, X-Cbo-Client-Url",
        "allow_method": "POST, GET, PUT, OPTIONS, DELETE"
    },
    "salt": "1f3f365ffdf4eb0777899420f0aca20a_test",
    "rollbar": {
        "access_token": "e0f67e505472424ca9728934a41fc416"
    },
    "aws": {
        "aws_access_key_id":"",
        "aws_secret_access_key":""
    },
    "cache": {
        "enable": true,
        "adapter": "redis",
        "backup": "redis",
        "redis": {
            "host": "api.cbo.upward.st",
            "port": "6379",
            "db": 0,
            "ttl": 86400
        },
        "memory": {
            "max": 100,
            "ttl": 60
        }
    }
}
var __i = false; if(typeof __local !== 'undefined') {__i = __local;}

var app = angular.module('CboPortal', ['ui.bootstrap','ui.router','ngLocationUpdate','ngRoute', 'ngCookies', 'ngPrettyJson', 'ui.date', 'anguFixedHeaderTable', 'scrollable-table', 'ngLocalize', 'ui.codemirror',
    'ngLocalize.Config'
]).value('localeConf', {
    basePath: 'languages',
    defaultLocale: 'en-US',
    sharedDictionary: 'general',
    fileExtension: '.lang.json',
    persistSelection: true,
    cookieName: 'COOKIE_LOCALE_LANG_',
    observableAttrs: new RegExp('^data-(?!ng-|i18n)'),
    delimiter: '::'
});

app.factory('headerInjector', [function () {
    'use strict';
    var headerInjector = {
        request: function (config) {
            config.headers['X-Cbo-Client-Url'] = __local;
            return config;
        }
    };
    return headerInjector;
}]);

app.config(['$httpProvider', function ($httpProvider) {
    'use strict';
    //Reset headers to avoid OPTIONS request (aka preflight)
    $httpProvider.defaults.headers.common = {};
    $httpProvider.defaults.headers.get = {};
    $httpProvider.defaults.headers.post = {};
    $httpProvider.defaults.headers.put = {};
    $httpProvider.defaults.headers.patch = {};
    $httpProvider.defaults.headers.common['Content-Type'] = 'application/x-www-form-urlencoded';
    $httpProvider.defaults.headers.common.Accept = '*/*';
    if (__i){$httpProvider.interceptors.push('headerInjector');}
    $httpProvider.defaults.timeout = 15000;

}]);

app.run(['$window', '$rootScope', '$route',
function ($window, $rootScope) {
    'use strict';
        $rootScope.goBack = function () {
            $window.history.back();
        };
        $rootScope.data_content = "asset/templates/desktop.html";
        //var element = angular.element("#login-container");
        if ($window.innerWidth > 767) {
            $rootScope.loginClass = "col-md-offset-4 col-md-4 login-page";
            $rootScope.data_content = "asset/templates/desktop.html";
        } else if ($window.innerWidth < 767) {
            $rootScope.loginClass = "col-md-offset-4 col-md-4 login-page-mobile";
            $rootScope.data_content = "asset/templates/mobile.html";
        }

}]);



app.run(["$state", "$stateParams", "$rootScope", "$http", "$location", "$window", "AuthenticationService", "CookieStore", "locale", function ($state, $stateParams,$rootScope, $http, $location, $window, AuthenticationService, CookieStore, locale) {
    'use strict';
    var returnData = CookieStore.getData();
    var checkCookie = CookieStore.checkCookie();

    locale.ready('general').then(function () {
        $rootScope.lang = {
            you_dont_have_any_permission_page: locale.getString('general.you_dont_have_any_permission_page'),
            success_logout: locale.getString('general.success_logout'),
            password_not_match: locale.getString('general.password_not_match')
        };
    });

    $rootScope.$on("$routeChangeStart", function (event, nextRoute) {
        //redirect only if both isAuthenticated is false and no token is set
        $rootScope.doingResolve = true;
        if (nextRoute !== null && /*nextRoute.access !== null &&  nextRoute.access.requiredAuthentication */nextRoute.requiredAuthentication && !AuthenticationService.isAuthenticated && !$window.sessionStorage.token) {
            if(checkCookie === true)
            {
                $location.path("/loading");
            }
            else
            {
                $location.path("/login");
            }
            $rootScope.showNavBar = false;
        }

        if (nextRoute !== null && /*nextRoute.access !== null && nextRoute.access.requiredAdmin*/nextRoute.requiredAdmin && (AuthenticationService.role+'').indexOf('case-worker') !== -1) {
            showError($rootScope.lang.you_dont_have_any_permission_page, 1);
            event.preventDefault();
        }

        if(nextRoute.$$route.originalPath !== '/login' && $rootScope.doingResolve === true){
            $rootScope.showFooter = false;

        }

        if('$$route' in nextRoute){
            var intended_url = '';
            if(nextRoute.$$route.originalPath === '/login'){
                $rootScope.is_logged_in = false;
            }

            if(nextRoute.$$route.originalPath !== '/login' && nextRoute.$$route.originalPath !== '/forget'){
                $rootScope.is_logged_in = true;
                $rootScope.showFooter = true;


                intended_url = _.get(nextRoute.$$route, 'originalPath');
                if(intended_url === '/program/students/:program_id'){
                    intended_url = '/program/students/'+ _.get(nextRoute.params,'program_id');
                }else if(intended_url === '/student/backpacks/:student_id'){
                    intended_url = '/student/backpacks/'+_.get(nextRoute.params,'student_id');
                }else if(intended_url === '/student/detail/:student_id'){
                    intended_url = '/student/detail/'+_.get(nextRoute.params,'student_id');
                }else if(intended_url === '/student/detail/:student_id/:tab_id'){
                    intended_url = '/student/detail/'+_.get(nextRoute.params,'student_id')+'/'+_.get(nextRoute.params,'tab_id');
                }else if(intended_url === '/student/edit/:student_id'){
                    intended_url = '/student/edit/'+_.get(nextRoute.params,'student_id');
                }else if(intended_url ==='/student/programs/:student_id/add'){
                    intended_url = '/student/programs/'+_.get(nextRoute.params,'student_id')+'/add';
                }else if(intended_url ==='/student/programs/:student_id'){
                    intended_url = '/student/programs/'+_.get(nextRoute.params,'student_id');
                }else if(intended_url ==='/program/detail/:program_id'){
                    intended_url = '/program/detail/'+_.get(nextRoute.params,'program_id');
                }else if(intended_url ==='/program/edit/:program_id'){
                    intended_url = '/program/edit/'+_.get(nextRoute.params,'program_id');
                }else if(intended_url ==='/program/students/:program_id/add'){
                    intended_url = '/program/students/'+_.get(nextRoute.params,'program_id')+'/add';
                }else if(intended_url ==='/program/students/:program_id/edit/:student_id'){
                    intended_url = '/program/students/'+_.get(nextRoute.params,'program_id')+'/edit/'+_.get(nextRoute.params,'student_id');
                }else if(intended_url ==='/program/students/:program_id'){
                    intended_url = '/program/students/'+_.get(nextRoute.params,'program_id');
                }else if(intended_url ==='/tag/edit/:tag_id'){
                    intended_url = '/tag/edit/'+_.get(nextRoute.params,'tag_id');
                }else if(intended_url ==='/user/group/:user_id/add'){
                    intended_url = '/user/group/'+_.get(nextRoute.params,'user_id')+'/add';
                }else if(intended_url ==='/user/group/:user_id'){
                    intended_url = '/user/group/'+_.get(nextRoute.params,'user_id');
                }else if(intended_url ==='/user/assign/:user_id'){
                    intended_url = '/user/assign/'+_.get(nextRoute.params,'user_id');
                }else if(intended_url ==='/user/edit/:user_id'){
                    intended_url = '/user/edit/'+_.get(nextRoute.params,'user_id');
                }else if(intended_url ==='/user/detail/:user_id'){
                    intended_url = '/user/detail/'+_.get(nextRoute.params,'user_id');
                }

                localStorage.setItem('intended_url',intended_url);
            }

        }
        if (returnData) {
            start_time_idle();
        }
        if($location.$$path === '/login'){
            $rootScope.showNavBar = false;
        }
    });
    $rootScope.$on('$stateChangeSuccess', function (event, toState, toParams, fromState) {
        $state.previous = fromState;
    });
}]);

app.run(['$route', '$rootScope', '$location', function ($route, $rootScope, $location) {
    'use strict';
    var original = $location.path;
    $location.path = function (path, reload) {
        if (reload === false) {
            var lastRoute = $route.current;
            var un = $rootScope.$on('$locationChangeSuccess', function () {
                $route.current = lastRoute;
                un();
            });
        }
        return original.apply($location, [path]);
    };
}]);

//app.run([
//    'myGoogleAnalytics',
//    function (myGoogleAnalytics) {
//            // inject self
//    }
//  ]);

function showError(message, alert) {
    'use strict';
    var passingClass = 'alert-danger';
    if (alert === 2) {
        passingClass = 'alert-success';
    }
    var message_alert = '<div class="alert ' + passingClass + ' alert-dismissible" role="alert"><button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button>' + message + '</div>';
    if(message !== null) {
        if (window.location.href.indexOf('/login') === -1) {
            jQuery(".error-container.visible-on").append(message_alert);
            setTimeout(function () {
                jQuery('.alert').remove();
            }, 3000);
        } else {
            jQuery("#login-error-message").append(message_alert);
            setTimeout(function () {
                jQuery('.alert').remove();
            }, 3000);
        }
    }
}

function base64_encode(data) {
    'use strict';
    var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var o1, o2, o3, h1, h2, h3, h4, bits, i = 0,
        ac = 0,
        enc = '',
        tmp_arr = [];

    if (!data) {
        return data;
    }

    do { // pack three octets into four hexets
        o1 = data.charCodeAt(i++);
        o2 = data.charCodeAt(i++);
        o3 = data.charCodeAt(i++);

        bits = o1 << 16 | o2 << 8 | o3;

        h1 = bits >> 18 & 0x3f;
        h2 = bits >> 12 & 0x3f;
        h3 = bits >> 6 & 0x3f;
        h4 = bits & 0x3f;

        // use hexets to index into b64, and append result to encoded string
        tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
    } while (i < data.length);

    enc = tmp_arr.join('');

    var r = data.length % 3;

    return (r ? enc.slice(0, r - 3) : enc) + '==='.slice(r || 3);
}


function start_time_idle() {
    'use strict';
    session_timeout.login();
}

function stop_time_idle() {
    'use strict';
    session_timeout.logout();
}
$(document).on( 'shown.bs.tab', '[data-toggle="tab"]', function (e) {
    'use strict';
    if(e.target.dataset.target === '#transcript'){
        $('#school-history-transcript').css({'display':''});
    }
    else{
        $('#school-history-transcript').css({'display':'none'});
    }

});
!function(n){"use strict";n.module("ngLocationUpdate",[]).run(["$route","$rootScope","$location",function(n,t,o){o.update_path=function(c,u){if(o.path()!=c){var a=n.current;t.$on("$locationChangeSuccess",function(){a&&(n.current=a,a=null)}),o.path(c),u||o.replace()}}}])}(window.angular);
app.config(["$routeProvider", function ($routeProvider) {
    'use strict';
    $routeProvider.
        when('/', {
            templateUrl: 'asset/templates/student/list.html',
            controller: 'StudentController',
            //access: {
                requiredAuthentication: true
            //}
        }).
        when('/student/add', {
            templateUrl: 'asset/templates/student/add.html',
            controller: 'StudentAddController',
            //access: {
                requiredAuthentication: true
            //}
        }).
        when('/student/backpacks/:student_id', {
            templateUrl: 'asset/templates/student/backpacks.html',
            controller: 'StudentBackpackController',
            //access: {
                requiredAuthentication: true
            //}
        }).
        when('/student/detail/:student_id', {
            templateUrl: 'asset/templates/student/detail.html',
            controller: 'StudentDetailController',
            //access: {
                requiredAuthentication: true
            //}
        }).
        when('/student/xsre/:student_id', {
            templateUrl: 'asset/templates/student/xsre.html',
            controller: 'StudentXSreController',
            //access: {
                requiredAuthentication: true
            //}
        }).
        when('/student/edit/:student_id', {
            templateUrl: 'asset/templates/student/edit.html',
            controller: 'StudentEditController',
            //access: {
                requiredAuthentication: true
            //}
        }).
        when('/student/programs/:student_id/add', {
            templateUrl: 'asset/templates/student/program_add.html',
            controller: 'StudentProgramAddController',
            //access: {
                requiredAuthentication: true
            //}
        }).
        when('/student/programs/:student_id', {
            templateUrl: 'asset/templates/student/program_list.html',
            controller: 'StudentProgramController',
            //access: {
                requiredAuthentication: true
            //}
        }).
        when('/student', {
            templateUrl: 'asset/templates/student/list.html',
            controller: 'StudentController',
            //access: {
                requiredAuthentication: true
            //}
        }).
        when('/profile/edit', {
            templateUrl: 'asset/templates/profile/edit.html',
            controller: 'ProfileEditController',
            //access: {
                requiredAuthentication: true
            //}
        }).
        when('/profile', {
            templateUrl: 'asset/templates/profile/detail.html',
            controller: 'ProfileController',
            //access: {
                requiredAuthentication: true
            //}
        }).
        when('/program/add', {
            templateUrl: 'asset/templates/program/add.html',
            controller: 'ProgramAddController',
            //access: {
                requiredAuthentication: true
            //}
        }).
        when('/program/detail/:program_id', {
            templateUrl: 'asset/templates/program/detail.html',
            controller: 'ProgramDetailController',
            //access: {
                requiredAuthentication: true
           // }
        }).
        when('/program/edit/:program_id', {
            templateUrl: 'asset/templates/program/edit.html',
            controller: 'ProgramEditController',
            //access: {
                requiredAuthentication: true
            //}
        }).
        when('/program/students/:program_id/add', {
            templateUrl: 'asset/templates/program/student_add.html',
            controller: 'ProgramStudentAddController',
            //access: {
                requiredAuthentication: true
            //}
        }).
        when('/program/students/:program_id/edit/:student_id', {
            templateUrl: 'asset/templates/program/student_edit.html',
            controller: 'ProgramStudentEditController',
            //access: {
                requiredAuthentication: true
            //}
        }).
        when('/program/students/:program_id', {
            templateUrl: 'asset/templates/program/student_list.html',
            controller: 'ProgramStudentController',
            //access: {
                requiredAuthentication: true
            //}
        }).
        when('/program', {
            templateUrl: 'asset/templates/program/list.html',
            controller: 'ProgramController',
            //access: {
                requiredAuthentication: true
            //}
        }).
        when('/tag/add', {
            templateUrl: 'asset/templates/tag/add.html',
            controller: 'TagAddController',
            //access: {
                requiredAuthentication: true,
                requiredAdmin: true
            //}
        }).
        when('/tag/edit/:tag_id', {
            templateUrl: 'asset/templates/tag/edit.html',
            controller: 'TagEditController',
            //access: {
                requiredAuthentication: true,
                requiredAdmin: true
            //}
        }).
        when('/tag', {
            templateUrl: 'asset/templates/tag/list.html',
            controller: 'TagController',
            //access: {
                requiredAuthentication: true,
                requiredAdmin: true
            //}
        }).
        when('/user/invite', {
            templateUrl: 'asset/templates/user/invite.html',
            controller: 'UserInviteController',
            //access: {
                requiredAuthentication: true,
                requiredAdmin: true
            //}
        }).
        when('/user/group/:user_id/add', {
            templateUrl: 'asset/templates/user/group_add.html',
            controller: 'UserGroupAddController',
            //access: {
                requiredAuthentication: true,
                requiredAdmin: true
            //}
        }).
        when('/user/group/:user_id', {
            templateUrl: 'asset/templates/user/group.html',
            controller: 'UserGroupController',
            //access: {
                requiredAuthentication: true,
                requiredAdmin: true
            //}
        }).
        when('/user/assign/:user_id', {
            templateUrl: 'asset/templates/user/assign.html',
            controller: 'UserAssignController',
            //access: {
                requiredAuthentication: true,
                requiredAdmin: true
            //}
        }).
        when('/user/edit/:user_id', {
            templateUrl: 'asset/templates/user/edit.html',
            controller: 'UserEditController',
            //access: {
                requiredAuthentication: true,
                requiredAdmin: true
            //}
        }).
        when('/user/detail/:user_id', {
            templateUrl: 'asset/templates/user/detail.html',
            controller: 'UserDetailController',
            //access: {
                requiredAuthentication: true
           // }
        }).
        when('/user', {
            templateUrl: 'asset/templates/user/list.html',
            controller: 'UserController',
            //access: {
                requiredAuthentication: true,
                requiredAdmin: true
            //}
        }).
        when('/heartbeat', {
            templateUrl: 'asset/templates/heartbeat/list.html',
            controller: 'HeartbeatController',
            //access: {
                requiredAuthentication: true
            //}
        }).
        when('/login', {
            templateUrl: 'asset/templates/login.html',
            controller: 'LoginController'
        }).
        when('/loading', {
            templateUrl: 'asset/templates/loading.html',
            controller: 'LoadingController'
        }).
        when('/forget', {
            templateUrl: 'asset/templates/forget.html',
            controller: 'LoginController'
        }).
        otherwise({
            redirectTo: '/'
        });

}]);
(function() {
  'use strict';
  CodeMirror.extendMode("css", {
    commentStart: "/*",
    commentEnd: "*/",
    newlineAfterToken: function(type, content) {
      return /^[;{}]$/.test(content);
    }
  });

  CodeMirror.extendMode("javascript", {
    commentStart: "/*",
    commentEnd: "*/",
    // FIXME semicolons inside of for
    newlineAfterToken: function(type, content, textAfter, state) {
      if (this.jsonMode) {
        return /^[\[,{]$/.test(content) || /^}/.test(textAfter);
      } else {
        if (content === ";" && state.lexical && state.lexical.type === ")") {return false;}
        return /^[;{}]$/.test(content) && !/^;/.test(textAfter);
      }
    }
  });

  CodeMirror.extendMode("xml", {
    commentStart: "<!--",
    commentEnd: "-->",
    newlineAfterToken: function(type, content, textAfter) {
      return type === "tag" && />$/.test(content) || /^</.test(textAfter);
    }
  });

  // Comment/uncomment the specified range
  CodeMirror.defineExtension("commentRange", function (isComment, from, to) {
    var cm = this, curMode = CodeMirror.innerMode(cm.getMode(), cm.getTokenAt(from).state).mode;
    cm.operation(function() {
      if (isComment) { // Comment range
        cm.replaceRange(curMode.commentEnd, to);
        cm.replaceRange(curMode.commentStart, from);
        if (from.line === to.line && from.ch === to.ch) // An empty comment inserted - put cursor inside
        {cm.setCursor(from.line, from.ch + curMode.commentStart.length);}
      } else { // Uncomment range
        var selText = cm.getRange(from, to);
        var startIndex = selText.indexOf(curMode.commentStart);
        var endIndex = selText.lastIndexOf(curMode.commentEnd);
        if (startIndex > -1 && endIndex > -1 && endIndex > startIndex) {
          // Take string till comment start
          selText = selText.substr(0, startIndex) + selText.substring(startIndex + curMode.commentStart.length, endIndex) + selText.substr(endIndex + curMode.commentEnd.length);
        }
        cm.replaceRange(selText, from, to);
      }
    });
  });

  // Applies automatic mode-aware indentation to the specified range
  CodeMirror.defineExtension("autoIndentRange", function (from, to) {
    var cmInstance = this;
    this.operation(function () {
      for (var i = from.line; i <= to.line; i++) {
        cmInstance.indentLine(i, "smart");
      }
    });
  });

  // Applies automatic formatting to the specified range
  CodeMirror.defineExtension("autoFormatRange", function (from, to) {
    var cm = this;
    var outer = cm.getMode(), text = cm.getRange(from, to).split("\n");
    var state = CodeMirror.copyState(outer, cm.getTokenAt(from).state);
    var tabSize = cm.getOption("tabSize");

    var out = "", lines = 0, atSol = from.ch === 0;
    function newline() {
      out += "\n";
      atSol = true;
      ++lines;
    }

    for (var i = 0; i < text.length; ++i) {
      var stream = new CodeMirror.StringStream(text[i], tabSize);
      while (!stream.eol()) {
        var inner = CodeMirror.innerMode(outer, state);
        var style = outer.token(stream, state), cur = stream.current();
        stream.start = stream.pos;
        if (!atSol || /\S/.test(cur)) {
          out += cur;
          atSol = false;
        }
        if (!atSol && inner.mode.newlineAfterToken &&
            inner.mode.newlineAfterToken(style, cur, stream.string.slice(stream.pos) || text[i+1] || "", inner.state))
        {newline();}
      }
      if (!stream.pos && outer.blankLine) {outer.blankLine(state);}
      if (!atSol) {newline();}
    }

    cm.operation(function () {
      cm.replaceRange(out, from, to);
      for (var cur = from.line + 1, end = from.line + lines; cur <= end; ++cur)
      {cm.indentLine(cur, "smart");}
      cm.setSelection(from, cm.getCursor(false));
    });
  });
})();

/**
 * Binds a CodeMirror widget to a <textarea> element.
 */
angular.module('ui.codemirror', [])
  .constant('uiCodemirrorConfig', {})
  .directive('uiCodemirror', uiCodemirrorDirective);

/**
 * @ngInject
 */
function uiCodemirrorDirective($timeout, uiCodemirrorConfig) {
  'use strict';
  return {
    restrict: 'EA',
    require: '?ngModel',
    compile: function compile() {

      // Require CodeMirror
      if (angular.isUndefined(window.CodeMirror)) {
        throw new Error('ui-codemirror needs CodeMirror to work... (o rly?)');
      }

      return postLink;
    }
  };

  function postLink(scope, iElement, iAttrs, ngModel) {

    var codemirrorOptions = angular.extend(
      { value: iElement.text() },
      uiCodemirrorConfig.codemirror || {},
      scope.$eval(iAttrs.uiCodemirror),
      scope.$eval(iAttrs.uiCodemirrorOpts)
    );

    var codemirror = newCodemirrorEditor(iElement, codemirrorOptions);

    configOptionsWatcher(
      codemirror,
      iAttrs.uiCodemirror || iAttrs.uiCodemirrorOpts,
      scope
    );

    configNgModelLink(codemirror, ngModel, scope);

    configUiRefreshAttribute(codemirror, iAttrs.uiRefresh, scope);

    // Allow access to the CodeMirror instance through a broadcasted event
    // eg: $broadcast('CodeMirror', function(cm){...});
    scope.$on('CodeMirror', function(event, callback) {
      if (angular.isFunction(callback)) {
        callback(codemirror);
      } else {
        throw new Error('the CodeMirror event requires a callback function');
      }
    });

    // onLoad callback
    if (angular.isFunction(codemirrorOptions.onLoad)) {
      codemirrorOptions.onLoad(codemirror);
    }
  }

  function newCodemirrorEditor(iElement, codemirrorOptions) {
    var codemirrot;

    if (iElement[0].tagName === 'TEXTAREA') {
      // Might bug but still ...
      codemirrot = window.CodeMirror.fromTextArea(iElement[0], codemirrorOptions);
    } else {
      iElement.html('');
      codemirrot = new window.CodeMirror(function(cm_el) {
        iElement.append(cm_el);
      }, codemirrorOptions);
    }

    return codemirrot;
  }

  function configOptionsWatcher(codemirrot, uiCodemirrorAttr, scope) {
    if (!uiCodemirrorAttr) { return; }

    var codemirrorDefaultsKeys = Object.keys(window.CodeMirror.defaults);
    scope.$watch(uiCodemirrorAttr, updateOptions, true);
    function updateOptions(newValues, oldValue) {
      if (!angular.isObject(newValues)) { return; }
      codemirrorDefaultsKeys.forEach(function(key) {
        if (newValues.hasOwnProperty(key)) {

          if (oldValue && newValues[key] === oldValue[key]) {
            return;
          }

          codemirrot.setOption(key, newValues[key]);
        }
      });
    }
  }

  function configNgModelLink(codemirror, ngModel, scope) {
    if (!ngModel) { return; }
    // CodeMirror expects a string, so make sure it gets one.
    // This does not change the model.
    ngModel.$formatters.push(function(value) {
      if (angular.isUndefined(value) || value === null) {
        return '';
      } else if (angular.isObject(value) || angular.isArray(value)) {
        throw new Error('ui-codemirror cannot use an object or an array as a model');
      }
      return value;
    });


    // Override the ngModelController $render method, which is what gets called when the model is updated.
    // This takes care of the synchronizing the codeMirror element with the underlying model, in the case that it is changed by something else.
    ngModel.$render = function() {
      //Code mirror expects a string so make sure it gets one
      //Although the formatter have already done this, it can be possible that another formatter returns undefined (for example the required directive)
      var safeViewValue = ngModel.$viewValue || '';
      codemirror.setValue(safeViewValue);
    };


    // Keep the ngModel in sync with changes from CodeMirror
    codemirror.on('change', function(instance) {
      var newValue = instance.getValue();
      if (newValue !== ngModel.$viewValue) {
        scope.$evalAsync(function() {
          ngModel.$setViewValue(newValue);
        });
      }
    });
  }

  function configUiRefreshAttribute(codeMirror, uiRefreshAttr, scope) {
    if (!uiRefreshAttr) { return; }

    scope.$watch(uiRefreshAttr, function(newVal, oldVal) {
      // Skip the initial watch firing
      if (newVal !== oldVal) {
        $timeout(function() {
          codeMirror.refresh();
        });
      }
    });
  }

}
uiCodemirrorDirective.$inject = ["$timeout", "uiCodemirrorConfig"];

app.controller('BodyController', ['$rootScope', '$scope', '$http', '$location', 'CookieStore', 'AuthenticationService',
    function ($rootScope, $scope, $http, $location, CookieStore, AuthenticationService, locale) {
        'use strict';
        var location = window.location.hash;
        if (location.indexOf('login') === -1) {
            $rootScope.show_footer = true;
        }


        $rootScope.full_screen = false;
        $rootScope.organization_name = CookieStore.get('organization_name');
        if (CookieStore.get('role') === 'admin') {
            $rootScope.users_link = true;
            $rootScope.tags_link = true;
        } else {
            $rootScope.users_link = false;
            $rootScope.tags_link = false;
        }
        $scope.isActive = function (route) {

            var route_length = route.length;
            var path = $location.path();
            var new_path = path.substr(0, route_length);
            return route === new_path;

        };


        $scope.logoutMe = function () {
            $rootScope.showFooter = false;
            var logout = {
                token: AuthenticationService.token
            };
            if(angular.isDefined(AuthenticationService.refresh_token)){
                logout.refresh_token = AuthenticationService.refresh_token;
            }
            $('.confidentiality-footer').removeClass('visible-on');
            $http.post(auth_url + 'logout', $.param(logout), {

            })
                .success(function () {
                    $rootScope.showNavBar = true;
                    CookieStore.clearData();
                    showError($rootScope.lang.success_logout, 2);
                    localStorage.setItem('url_intended','');
                    //console.log(localStorage);
                    $location.path("/login");

                })
                .error(function () {

                    var myEl = angular.element(document.querySelector('body'));
                    myEl.removeClass('cbp-spmenu-push');
                    //console.log(response);
                    //console.log(status);

                    CookieStore.clearData();
                    showError($rootScope.lang.success_logout, 2);
                    $location.path("/login");

                });

        };

        $scope.refreshMe = function () {

            var auth = base64_encode(globalConfig.client_id + ':' + globalConfig.client_secret);
            //var grant_type = encodeURIComponent(globalConfig.grant_type);
            var uri = auth_url + 'oauth2/token';
            var send = {
                grant_type: 'refresh_token',
                refresh_token: AuthenticationService.refresh_token
            };

            $http.post(uri, $.param(send), {
                headers: {
                    'Authorization': 'Basic ' + auth
                }
            })
                .success(function (response) {

                    clearTimeout(session_timeout.warningTimer);

                    CookieStore.put('token', response.access_token);
                    CookieStore.put('refresh_token', response.refresh_token);
                    AuthenticationService.token = response.access_token;
                    AuthenticationService.refresh_token = response.refresh_token;

                })
                .error(function (response) {

                    //console.log('fail');
                    //console.log(response);
                    //console.log(status);

                    CookieStore.clearData();
                    showError(response.message, 2);
                    $location.path("/login");

                });

        };

        $rootScope.doingResolve = true;

    }
]);
app.controller('HeartbeatController', ['$rootScope', '$scope',
    function ($rootScope) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;

    }
]);
app.controller('HomeController', ['$rootScope', '$scope',
    function ($rootScope) {
'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;

    }
]);
app.controller('LoginController', ['$rootScope', '$scope', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        stop_time_idle();

        $rootScope.full_screen = true;
        $rootScope.doingResolve = false;
        var getRemember = CookieStore.get('remember');
        if (getRemember === true) {
            $scope.login = {
                username: CookieStore.get('email'),
                remember_username: true
            };
        }

        $scope.loginMe = function (username, password, remmember) {

            if(!$scope.login) {
                $scope.login = {};
            }

            $scope.login.working = true;

            var auth = base64_encode(globalConfig.client_id + ':' + globalConfig.client_secret);
            var grant_type = encodeURIComponent(globalConfig.grant_type);
            var uri = auth_url + 'oauth2/token';
            var send = {
                grant_type: grant_type,
                username: username,
                password: password,
                scope: 'offline_access'
            };

            $http.post(uri, $.param(send), {
                headers: {
                    'Authorization': 'Basic ' + auth
                }
            })
                .success(function (response) {

                    $http.get(api_url + 'organizations', {
                        headers: {
                            'Authorization': 'Bearer ' + response.access_token
                        }
                    })
                        .success(function (responseClient) {
                            $rootScope.show_footer = true;
                            var get_hosting_name = $location.host();
                            var grand_access = false;
                            var get_id = false;
                            var get_redirect_url = false;
                            var organization_name = '';


                            if (responseClient.success === true && responseClient.total > 0) {
                                $rootScope.organization_name = responseClient.data.name;
                                for (var i = 0; i < responseClient.total; i++) {
                                    if (__i || get_hosting_name === responseClient.data[i].url) {
                                        grand_access = true;
                                        get_id = responseClient.data[i]._id;
                                        get_redirect_url = responseClient.data[i].url;
                                        var myEl = angular.element(document.querySelector('body'));
                                        myEl.addClass('cbp-spmenu-push');
                                        organization_name = responseClient.data[i].name;
                                    }
                                }
                            }

                            if (grand_access) {
                                $http.get(api_url + get_id + '/users', {
                                    headers: {
                                        'Authorization': 'Bearer ' + response.access_token
                                    }
                                })
                                    .success(function (responseUser) {

                                        if (responseUser.success === true && responseUser.total > 0) {
                                            var find = false;
                                            var data = responseUser.data;
                                            var id = false;
                                            var complete_name = '';
                                            var role = 'case-worker-restricted';
                                            for (var i = 0; i < responseUser.total; i++) {
                                                if (data[i].email === send.username) {
                                                    id = data[i]._id;
                                                    if (typeof data[i].first_name !== 'undefined' && data[i].first_name) {
                                                        complete_name += data[i].first_name + ' ';
                                                    }
                                                    if (typeof data[i].last_name !== 'undefined' && data[i].last_name) {
                                                        complete_name += data[i].last_name;
                                                    }

                                                    //if (data[i].permissions.length > 0) {
                                                    //    for (var j = 0; j < data[i].permissions.length; j++) {
                                                    //        if (data[i].permissions[j].organization == get_id) {
                                                    //            role = data[i].permissions[j].role;
                                                    //        }
                                                    //    }
                                                    //}
                                                    role = data[i].role;

                                                    if (role === 'admin') {
                                                        $rootScope.users_link = true;
                                                        $rootScope.tags_link = true;
                                                    } else {
                                                        $rootScope.users_link = false;
                                                        $rootScope.tags_link = false;
                                                    }
                                                    $rootScope.completeName = complete_name;
                                                    find = true;
                                                }
                                            }
                                            if (find) {
                                                CookieStore.setData(response.access_token, response.refresh_token, get_id, get_redirect_url, id, send.username, complete_name, role, organization_name, response.expires_in);
                                                global_redirect_url = get_redirect_url;

                                                if (typeof remmember !== 'undefined' && remmember === true) {
                                                    CookieStore.put_remember(true);
                                                } else {
                                                    CookieStore.put_remember(false);
                                                }


                                            }
                                            start_time_idle();
                                            if('intended_url' in localStorage && localStorage.getItem('intended_url')!==''){
                                                $location.path(localStorage.getItem('intended_url'));
                                            }else {
                                                $location.path('/');
                                            }

                                        } else {
                                            showError(response.error.message, 1);
                                        }
                                        $rootScope.doingResolve = false;

                                    })
                                    .error(function (responseUser) {

                                        showError(responseUser, 1);
                                        $scope.login.working = false;

                                    });

                            } else {
                                showError($rootScope.lang.you_dont_have_any_permission_page, 1);
                                $scope.login.working = false;
                            }

                        })
                        .error(function (responseClient) {

                            showError(responseClient, 1);
                            $scope.login.working = false;

                        });

                })
                .error(function (response) {
                    //console.log(response);
                    showError(response.error_description, 1);
                    $scope.login.working = false;

                });

        };

        $scope.forgotPassword = function (user) {

            if (user) {
                user.redirect_url = window.location.origin;
                $scope.working = true;
                $http.post(auth_url + '/user/send/forgotpassword', $.param(user), {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function (response) {
                        //console.log(response);
                        if (response.success === true) {
                            showError(response.message, 2);
                        } else {
                            showError(response.message, 1);
                        }
                        $scope.working = false;

                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }
        };


    }
]);
app.controller('ProfileController', ['$rootScope', '$scope', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;
        $rootScope.editable = false;

        $scope.activateEditable = function () {
            $rootScope.editable = true;
        };

        $http.get(api_url + 'user/', {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {
                $scope.user = response;
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response.error, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

        $scope.editProfile = function (data) {
            if (data) {
                $scope.working = true;
                if (data.password !== data.retype_password) {

                    showError($rootScope.lang.password_not_match, 1);
                    $scope.working = false;
                } else {
                    var user = {
                        "email": data.email,
                        "first_name": data.first_name,
                        "middle_name": data.middle_name,
                        "last_name": data.last_name,
                        "password": data.password,
                        "retype_password": data.retype_password
                    };
                    $scope.working = true;
                    //$http.put( api_url+AuthenticationService.organization_id+'/users/'+AuthenticationService.user_id, $.param(user), {

                    $http.put(api_url + 'user/', $.param(user), {
                        headers: {
                            'Authorization': 'Bearer ' + AuthenticationService.token
                        }
                    })
                        .success(function (response) {

                            if (response.success === true) {
                                $scope.working = false;
                                $location.path('/profile');
                                //console.log("Successfully updated");
                                $rootScope.doingResolve = false;
                                showError(response.message, 2);
                                var complete_name = '';
                                if (typeof user.first_name !== 'undefined' && user.first_name) {
                                    complete_name += user.first_name + ' ';
                                }
                                if (typeof user.last_name !== 'undefined' && user.last_name) {
                                    complete_name += user.last_name;
                                }

                                $rootScope.completeName = complete_name;

                            } else {
                                showError(response.message, 1);
                            }
                            $scope.working = false;

                        })
                        .error(function (response, status) {

                            //console.log(response);
                            //console.log(status);
                            showError(response.error, 1);
                            $scope.working = false;
                            if (status === 401) {
                                $rootScope.show_footer = false;
                                CookieStore.clearData();
                                $location.path('/login');
                            }

                        });
                }
            }
        };

    }
]);
app.controller('ProfileEditController', ['$rootScope', '$scope', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;
        $scope.editProfile = function (user) {
            if (user) {


                $scope.working = true;
                $http.put(api_url + 'user', $.param(user), {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function (response) {

                        if (response.success === true) {
                            showError(response.message, 2);
                            var complete_name = '';
                            if (typeof user.first_name !== 'undefined' && user.first_name) {
                                complete_name += user.first_name + ' ';
                            }
                            if (typeof user.last_name !== 'undefined' && user.last_name) {
                                complete_name += user.last_name;
                            }

                            $rootScope.completeName = complete_name;
                            $location.path('/profile');

                        } else {
                            showError(response.message, 1);
                        }
                        $scope.working = false;

                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response.error, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }
        };
        $http.get(api_url + 'user', {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                $scope.user = response;
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response.error, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

    }

]);
app.controller('ProgramAddController', ['$rootScope', '$scope', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;

        $scope.addProgram = function (program) {
            if (program) {
                program.redirect_url = AuthenticationService.redirect_url;

                $scope.working = true;
                $http.post(api_url + AuthenticationService.organization_id + '/programs', $.param(program), {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function (response) {
                        if (response.success) {
                            showError(response.message, 2);
                            $scope.working = false;
                            $location.path('/program');
                        } else {
                            showError(response.message, 1);
                            $scope.working = false;
                        }


                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response.error, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }
        };

    }
]);
app.controller('ProgramController', ['$rootScope', '$scope', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $scope.programs = [];

        $scope.deleteProgram = function (id, index) {

            if (id) {
                $scope.working = true;
                $http.delete(api_url + AuthenticationService.organization_id + '/programs/' + id, {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function (response) {
                        showError(response.message, 2);
                        $scope.programs.splice(index, 1);
                        $scope.working = false;
                        $location.path('/program');

                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }
        };

        $http.get(api_url + AuthenticationService.organization_id + '/programs', {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                if (response.success === true && response.total > 0) {
                    $scope.programs = response.data;
                } else {
                    showError(response.error.message, 1);
                }
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

    }
]);
app.controller('ProgramDetailController', ['$rootScope', '$scope', '$routeParams', '$http', '$location', 'AuthenticationService', 'CookieStore','$filter',
    function ($rootScope, $scope, $routeParams, $http, $location, AuthenticationService, CookieStore,$filter) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;
        $rootScope.editable = false;

        var program_id = $routeParams.program_id;

        $scope.activateEditable = function () {
            $rootScope.editable = true;
        };

        $scope.editProgram = function (program) {
            if (program) {
                program.redirect_url = AuthenticationService.redirect_url;

                $scope.working = true;
                $http.put(api_url + AuthenticationService.organization_id + '/programs/' + program_id, $.param(program), {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function (response) {

                        showError(response.message, 2);
                        $scope.working = false;
                        $location.path('program/detail/' + program_id);
                    })
                    .error(function (response, status) {

                        showError(response, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }

            $rootScope.editable = false;
        };

        $scope.deleteProgram = function (id, index) {
            if (id) {
                $scope.working = true;
                $http.delete(api_url + AuthenticationService.organization_id + '/programs/' + id, {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function (response) {
                        $scope.working = false;
                        $location.path('/program');

                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }
        };

        $http.get(api_url + AuthenticationService.organization_id + '/programs/' + program_id, {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                $scope.program = response;
                $scope.program.created = $filter('date')(new Date(response.created),'MM/dd/yyyy HH:mm:ss');
                $scope.program.last_updated = $filter('date')(new Date(response.last_updated),'MM/dd/yyyy HH:mm:ss');
                $rootScope.doingResolve = false;


            })
            .error(function (response, status) {

                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

    }
]);
app.controller('ProgramEditController', ['$rootScope', '$scope', '$routeParams', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $routeParams, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;

        var program_id = $routeParams.program_id;

        $scope.editProgram = function (program) {
            if (program) {
                program.redirect_url = AuthenticationService.redirect_url;

                $scope.working = true;
                $http.put(api_url + AuthenticationService.organization_id + '/programs/' + program_id, $.param(program), {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function (response) {

                        showError(response.message, 2);
                        $scope.working = false;
                        $location.path('/program');
                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }
        };

        $http.get(api_url + AuthenticationService.organization_id + '/programs/' + program_id, {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                $scope.program = response;
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

    }
]);
app.controller('ProgramStudentAddController', ['$rootScope', '$scope', '$routeParams', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $routeParams, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;
        var rawCohart = '';
        var program_id = $routeParams.program_id;


        $http.get(api_url + AuthenticationService.organization_id + '/programs/' + program_id, {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {
                $scope.program = response;
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

        $http.get(api_url + AuthenticationService.organization_id + '/tags', {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                var availableTags = [];
                for (var i = 0; i < response.data.length; i++) {
                    availableTags.push(response.data[i].name);
                }


                jQuery("#cohort").tagit({
                    availableTags: availableTags
                });


                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

        $http.get(api_url + AuthenticationService.organization_id + '/students', {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                if (response.success === true && response.total > 0) {
                    $scope.list_student = response.data;
                } else {
                    showError(response.error.message, 1);
                }
                $rootScope.doingResolve = false;
                $scope.program ? $scope.program.active = true : $scope.program = {
                    active: true
                };
            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });
        $scope.addProgramStudent = function (program) {
            if (program) {
                if (program.cohort !== null) {
                    rawCohart = program.cohort.split(',');
                } else if (program.cohort === 'undefined' || program.cohort === 'undefined') {
                    rawCohart = '';
                }
                program.cohort = rawCohart;
                $scope.working = true;
                $http.post(api_url + AuthenticationService.organization_id + '/programs/' + program_id + '/students', $.param(program), {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function (response) {
                        if (response.success === false) {
                            $scope.working = false;
                            showError(response.error, 1);
                        } else {
                            showError(response.message, 2);
                            $location.path('/program/students/' + program_id);

                            $scope.working = false;
                        }


                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }
        };

    }
]);
app.controller('ProgramStudentController', ['$rootScope', '$scope', '$routeParams', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $routeParams, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;
        var program_id = $routeParams.program_id;
        var active_status = '';
        var start_date = '';
        var end_date = '';
        var cohort = '';
        $scope.students = [];
        $http.get(api_url + AuthenticationService.organization_id + '/programs/' + program_id, {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {
                $scope.program = response;
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

        $http.get(api_url + AuthenticationService.organization_id + '/programs/' + program_id + '/students', {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {
                //console.log(response);
                if (response.success === true && response.total > 0) {

                    angular.forEach(response.data, function (value, key) {

                        cohort = '';
                        angular.forEach(value.programs, function (v, k) {
                            if (v.program === program_id) {
                                active_status = v.active;
                                start_date = v.participation_start_date;
                                end_date = v.participation_end_date;
                                cohort = v.cohort.join();
                                var student = {
                                    "_id": value._id,
                                    "name": value.first_name + ' ' + value.last_name,
                                    "active": active_status,
                                    "start_date": start_date,
                                    "end_date": end_date,
                                    "cohort": cohort
                                };
                                $scope.students.push(student);
                            }
                        });



                    });
                }
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

        $scope.deleteStudent = function (id, index) {
            if (id) {
                $scope.working = true;
                $http.delete(api_url + AuthenticationService.organization_id + '/programs/' + program_id + '/students/' + id, {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function (response) {

                        if (response.success) {
                            $scope.students.splice(index, 1);
                            $scope.working = false;
                            $location.path('/program/students/' + program_id);
                        }

                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });

            }
        };

    }
]);
app.controller('ProgramStudentEditController', ['$rootScope', '$scope', '$routeParams', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $routeParams, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;

        var student_id = $routeParams.student_id;
        var program_id = $routeParams.program_id;
        var cohort = '';
        var active_status = '';
        var start_date = '';
        var end_date = '';

        $http.get(api_url + AuthenticationService.organization_id + '/programs/' + program_id, {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {
                $scope.program = response;
            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response.error, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

        $http.get(api_url + AuthenticationService.organization_id + '/programs/' + program_id + '/students/' + student_id, {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {
                //console.log(response);
                angular.forEach(response.programs, function (v, k) {

                    if (program_id === v.program) {
                        active_status = v.active;
                        start_date = v.participation_start_date;
                        end_date = v.participation_end_date;
                        cohort = v.cohort.join();
                    }

                });

                $scope.student = {
                    "_id": response._id,
                    "name": response.first_name + ' ' + response.last_name,
                    "active": active_status,
                    "participation_start_date": start_date,
                    "participation_end_date": end_date,
                    "cohort": cohort
                };


                $http.get(api_url + AuthenticationService.organization_id + '/tags', {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function (responseTag) {

                        var availableTags = [];
                        for (var i = 0; i < responseTag.data.length; i++) {
                            availableTags.push(responseTag.data[i].name);
                        }


                        jQuery("#cohort").tagit({
                            availableTags: availableTags
                        });


                    })
                    .error(function (responseTag) {

                        //console.log(responseTag);
                        //console.log(statusTag);
                        showError(responseTag, 1);
                        $rootScope.doingResolve = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });

                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response.error, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });


        $scope.editProgramStudent = function (student) {
            if (student) {
                $scope.working = true;

                $http.put(api_url + AuthenticationService.organization_id + '/programs/' + program_id + '/students/' + student_id, $.param(student), {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function (response) {

                        showError(response.message, 2);
                        $scope.working = false;
                        $location.path('/program/students/' + program_id);
                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response.error, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }

            $rootScope.editable = false;
        };
    }
]);
app.controller('StudentAddController', ['$rootScope', '$scope', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        var schoolDistrict = {};
        var relationship = {};
        $scope.schoolDistricts = [];
        $scope.relationships = [];
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;

        $.each(schoolDistricts, function (key, value) {
            schoolDistrict = {
                "id": key,
                "name": value
            };
            $scope.schoolDistricts.push(schoolDistrict);
        });
        $.each(relationships, function (key, value) {
            relationship = {
                "id": key,
                "name": value
            };
            $scope.relationships.push(relationship);
        });

        $scope.addStudent = function (student) {
            if (student) {
                $scope.working = true;
                $http.post(api_url + AuthenticationService.organization_id + '/students', $.param(student), {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function (response) {

                        if (response.success === true) {
                            showError(response.message, 2);
                            $location.path('/student');
                        } else {
                            showError(response.message, 1);
                        }
                        $scope.working = false;

                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response.error, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $rootScope.show_footer = false;
                            $location.path('/login');
                        }

                    });
            }
        };

    }
]);
app.controller('StudentBackpackController', ['$rootScope', '$scope', '$routeParams', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $routeParams, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $scope.student = {};

        var student_id = $routeParams.student_id;

        $http.get(api_url + AuthenticationService.organization_id + '/students/' + student_id + '/xsre', {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {
                $scope.student = response;
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response.error, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

    }
]);
app.controller('StudentController', ['$rootScope', '$scope', '$http', '$location', 'AuthenticationService', 'CookieStore', 'locale', '$timeout','$document',
    function ($rootScope, $scope, $http, $location, AuthenticationService, CookieStore, locale, $timeout) {
        'use strict';

        var districtOption = {};
        var options = [];
//        var school_options = [];
//        var schoolOptions = {};
        var pluralBehavior = '';
        var pluralAttendance = '';
        $scope.district_counter = 0;
        $scope.school_counter = 0;
        $rootScope.full_screen = false;
        $scope.students = [];
        $scope.districtData = [];
        $scope.schoolNameData = [];
        $scope.selected_districts = [];
        $scope.selected_schools = [];
        $scope.filterSettings = {
            scrollableHeight: '250px',
            scrollable: true
        };
        $scope.test = "Test";

        $scope.filterDistrict = function () {
            return function (p) {
                if(String($scope.selected_districts) !== '') {
                    $scope.district_counter =  $scope.selected_districts.length;
                    for (var i in $scope.selected_districts) {
                        if (p.school_district === $scope.selected_districts[i]) {

                            return true;
                        }
                    }

                }else{
                    $scope.district_counter = 0;
                    return true;

                }

            };
        };
        $scope.filterSchools = function () {
            return function (p) {
                if(String($scope.selected_schools) !== '') {
                    $scope.school_counter =  $scope.selected_schools.length;
                    for (var i in $scope.selected_schools) {
                        if (p.schoolName.replace(/<[^>]+>/gm, '') === $scope.selected_schools[i].replace(/<[^>]+>/gm, '')) {
                            return true;
                        }
                    }

                }else{
                    $scope.school_counter = 0;
                    return true;
                }

            };
        };


        $scope.deleteStudent = function (id, index) {
            if (id) {
                $scope.working = true;
                $http.delete(api_url + AuthenticationService.organization_id + '/students/' + id, {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function () {

                        $scope.students.splice(index, 1);
                        $scope.working = false;

                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response.error, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }
        };

        var pullXsreStudents = function(studentKeys){

            angular.forEach($scope.students, function(student){
                student.gradeLevel = locale.getString('general.retrieving');
                student.schoolYear = locale.getString('general.retrieving');
                student.schoolName = locale.getString('general.retrieving');
                student.attendance = locale.getString('general.retrieving');
                student.behavior = locale.getString('general.retrieving');
                student.onTrackGraduate = locale.getString('general.retrieving');

                $http.get(api_url + AuthenticationService.organization_id + '/students/'+student._id+'?xsre=1', {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    },
                    timeout: 75000
                })
                    .success(function (student) {
                        if(student._id in studentKeys){
                            var onTrack = _.get(student,'xsre.onTrackToGraduate');
                            if(parseInt(_.get(student,'xsre.behavior')) <= 1){
                                pluralBehavior =  locale.getString('general.incident', [_.get(student,'xsre.behavior')]);
                            }else{
                                pluralBehavior = locale.getString('general.incidents', [_.get(student,'xsre.behavior')]);
                            }

                            if(parseInt(_.get(student,'xsre.attendance')) <= 1){
                                pluralAttendance =  locale.getString('general.day_missed', [_.get(student,'xsre.attendance')]);
                            }else{
                                pluralAttendance = locale.getString('general.days_missed', [_.get(student,'xsre.attendance')]);
                            }
                            if(onTrack === 'Y'){
                                onTrack = locale.getString('general.on_track');
                            } else if(onTrack === 'N') {
                                onTrack = locale.getString('general.off_track');
                            } else {
                                onTrack = locale.getString('general.unavailable');
                            }
                            $scope.students[studentKeys[student._id]].gradeLevel = _.get(student, 'xsre.gradeLevel') || locale.getString('general.unavailable');
                            $scope.students[studentKeys[student._id]].schoolYear = _.get(student,'xsre.schoolYear') || locale.getString('general.unavailable');
                            $scope.students[studentKeys[student._id]].schoolName = _.get(student,'xsre.schoolName') || locale.getString('general.unavailable');
                            $scope.students[studentKeys[student._id]].attendance = _.has(student,'xsre.attendance') ? pluralAttendance : locale.getString('general.unavailable');
                            $scope.students[studentKeys[student._id]].behavior = _.has(student,'xsre.behavior') ? pluralBehavior : locale.getString('general.unavailable');
                            $scope.students[studentKeys[student._id]].onTrackGraduate = onTrack;

                        } else {

                            $scope.students[studentKeys[student._id]].gradeLevel = locale.getString('general.unavailable');
                            $scope.students[studentKeys[student._id]].schoolYear = locale.getString('general.unavailable');
                            $scope.students[studentKeys[student._id]].schoolName = locale.getString('general.unavailable');
                            $scope.students[studentKeys[student._id]].attendance = locale.getString('general.unavailable');
                            $scope.students[studentKeys[student._id]].behavior = locale.getString('general.unavailable');
                            $scope.students[studentKeys[student._id]].onTrackGraduate = locale.getString('general.unavailable');

                        }

                        var find = $scope.students[studentKeys[student._id]].schoolName;
                        if(find){
                            find      = String(find).replace(/<[^>]+>/gm, '');
                            var found = $scope.schoolNameData.some(function(hash){
                                if(_.includes(hash, find)) {return true;}
                            });
                            if(!found){
                                $scope.schoolNameData.push({ id: find, name: find });
                            }
                        }
                    })
                    .error(function (response, status) {

                        //console.log('ERROR: ', student, typeof response, response, typeof status, status);
                        showError(response, 1);
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        } else if(status >= 500 || (response === null && status === 0)){
                            $scope.students[studentKeys[student._id]].gradeLevel = locale.getString('general.unavailable');
                            $scope.students[studentKeys[student._id]].schoolYear = locale.getString('general.unavailable');
                            $scope.students[studentKeys[student._id]].schoolName = locale.getString('general.unavailable');
                            $scope.students[studentKeys[student._id]].attendance = locale.getString('general.unavailable');
                            $scope.students[studentKeys[student._id]].behavior = locale.getString('general.unavailable');
                            $scope.students[studentKeys[student._id]].onTrackGraduate = locale.getString('general.unavailable');
                        }

                    });
            });

        };

        $http.get(api_url + AuthenticationService.organization_id + '/students', {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                if (response.success === true && response.total > 0) {
                    var embedData = [];
                    embedData = ('data' in response) ? response.data : [];

                    var data = [];
                    var o = 0;
                    var studentKeys = {};
                    angular.forEach(embedData, function (student) {
                        $.each(schoolDistricts, function (key, value) {
                            if (key === student.school_district || value === student.school_district) {
                                student.school_district = value;
                            }
                        });
                        student.gradeLevel = locale.getString('general.not_ready');
                        student.schoolYear = locale.getString('general.not_ready');
                        student.schoolName = locale.getString('general.not_ready');
                        student.attendance = locale.getString('general.not_ready');
                        student.behavior = locale.getString('general.not_ready');
                        student.onTrackGraduate = locale.getString('general.not_ready');
                        $scope.students.push(student);
                        studentKeys[student._id] = o;
                        o++;
                        if(options.indexOf(student.school_district) === -1){
                            options.push(student.school_district);
                        }

                    });
                    /**
                     * Get XSRE
                     */
                    $timeout( function(){ pullXsreStudents(studentKeys); }, 30);

                    angular.forEach(options,function(value){
                        districtOption = {
                            id:value,
                            name:value
                        };
                        $scope.districtData.push(districtOption);
                    });

                } else {
                    showError(response.error.message, 1);
                }
                $rootScope.doingResolve = false;
            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

    }
]);
app.controller('StudentDetailController', ['$route', '$rootScope', '$scope', '$routeParams', '$http', '$location', 'AuthenticationService', 'CookieStore', '$sce', '$window',
    function ($route, $rootScope, $scope, $routeParams, $http, $location, AuthenticationService, CookieStore, $sce, $window) {
        'use strict';

        var urlTemplate = 'asset/templates/popoverTemplate.html';
        $scope.templateUrl = 'asset/templates/popoverTemplate.html';
        $rootScope.full_screen = false;
        $scope.student = {};
        $scope.programs = [];
        $scope.list_programs = [];
        $scope.icon_legend = true;
        $scope.open_button = false;

        $scope.close = function () {
            $scope.open_button = true;
            $scope.icon_legend = false;
        };
        $scope.open = function () {
            $scope.icon_legend = true;
            $scope.open_button = false;
        };
        var student_id = $routeParams.student_id;
        var groupValue = "_INVALID_GROUP_VALUE_";
        $scope.viewDebug = $routeParams.debug ? true : false;
        $scope.sch_history = false;
        $scope.academic = true;

        $scope.showSchoolHistory = function () {
            $scope.sch_history = true;

        };

        $scope.closeSchoolHistory = function () {
            $scope.sch_history = false;


        };

        $scope.hideIcon = function (event) {

            var li = $(event.target).parent()[0];
            var attendance_header = $(li).parent()[0];
            var attendance_detail = $(attendance_header).siblings()[0];

            $(attendance_detail).removeClass('hide');
            $(attendance_header).addClass('hide');

        };
        $scope.showIcon = function (event) {

            var id = $(event.target).prop('id');
            var attendance_legend = $(event.target).parent()[0];
            var panel_body = $(attendance_legend).parent()[0];
            var panel_collapse = $(panel_body).parent()[0];
            var panel_heading = $($(panel_collapse).siblings(), id);
            var h4 = $(panel_heading).children()[0];
            var attendance_header = $(h4).children()[0];
            var attendance_detail = $(h4).children()[1];
            if ($(attendance_header).hasClass('hide')) {
                $(attendance_header).removeClass('hide');
            }

            $(attendance_detail).addClass('hide');

        };
        $('[data-toggle="tab"]').on('show.bs.tab', function (e) {
            $scope.setStudentDetailActiveTab(e.target.dataset.target);
        });
        // Save active tab to localStorage
        $scope.setStudentDetailActiveTab = function (activeTab) {
            localStorage.setItem("activeTabStudentDetail", activeTab);
        };

        // Get active tab from localStorage
        $scope.getStudentDetailActiveTab = function () {
            return localStorage.getItem("activeTabStudentDetail");
        };

        // Check if current tab is active
        $scope.isStudentDetailActiveTab = function (tabName, index) {
            var activeTab = $scope.getStudentDetailActiveTab();
            var is = (activeTab === tabName || (activeTab === null && index === 0));
            return is;
        };


        $http.get(api_url + AuthenticationService.organization_id + '/students/' + student_id, {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                $.each(schoolDistricts, function (key, value) {
                    if (key === response.school_district) {
                        response.school_district = value;
                    }
                });

                $scope.student = response;

                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                showError(response.error, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });


        var getXsre = function () {

            $scope.loading_icon = false;
            $('.loading-icon').removeClass('hide');
            $http.get(api_url + AuthenticationService.organization_id + '/students/' + student_id + '/xsre', {
                headers: {
                    'Authorization': 'Bearer ' + AuthenticationService.token
                }
            })
                .success(function (response) {

                    var embedUsers = {};
                    var embedPrograms = [];
                    $scope.attendanceBehavior = [];
                    $scope.xsreLastUpdated = null;
                    if (response.success !== false && response.info) {

                        response = response.info;

                        var personal = $scope.personal = response.personal;

                        $scope.case_workers = response._embedded.users;
                        embedUsers = ('users' in response._embedded) ? response._embedded.users : {};
                        embedPrograms = ('programs' in response._embedded) ? response._embedded.programs : [];

                        $scope.case_workers = embedUsers;
                        $scope.daysAttendance = parseInt(personal.daysInAttendance);
                        $scope.daysAbsent = parseInt(personal.daysAbsent);


                        if (response.attendanceBehaviors) {
                            angular.forEach(response.attendanceBehaviors, function (behavior) {

                                Object.keys(behavior).forEach(function (key) {
                                    var columnHtml = {};
                                    angular.forEach(behavior[key].detailColumns, function (column, i) {

                                        if (i !== 'periods' && i !== 'weeklyChange') {
                                            var xhtml = [];
                                            var x = 1;
                                            var cls = '';
                                            angular.forEach(column, function (item, n) {

                                                if (n > 0) {
                                                    var html = {};
                                                    cls = (x % 2 === 0) ? 'light' : '';
                                                    x++;
                                                    if (typeof item === 'object' && item.event !== null) {
                                                        html = {
                                                            slug: item.slug,
                                                            stripping: cls,
                                                            na: '',
                                                            fontcolor: item.slug + '-font-color',
                                                            pagetitle: item.slug.toUpperCase(),
                                                            eventdate: item.event.calendarEventDate,
                                                            description: item.event.attendanceStatusTitle,
                                                            url: urlTemplate
                                                        };
                                                    } else {
                                                        html = {
                                                            slug: '',
                                                            stripping: cls,
                                                            na: 'n_a',
                                                            fontcolor: '',
                                                            pagetitle: '',
                                                            eventdate: '',
                                                            description: '',
                                                            url: ''
                                                        };
                                                    }
                                                    xhtml.push(html);
                                                }
                                            });

                                            for (; x < 8; x++) {
                                                html = {
                                                    slug: '',
                                                    stripping: '',
                                                    na: '',
                                                    fontcolor: '',
                                                    pagetitle: '',
                                                    eventdate: '',
                                                    description: '',
                                                    url: ''
                                                };
                                                xhtml.push(html);
                                            }
                                            var items = behavior[key].behaviors[i];

                                            if (items.length > 0) {

                                                angular.forEach(items, function (item, i) {
                                                    var html = {};
                                                    if (typeof item === 'object') {
                                                        html = {
                                                            slug: 'unexcused',
                                                            stripping: cls,
                                                            na: '',
                                                            fontcolor: 'unexcused-font-color',
                                                            pagetitle: (item.incidentCategoryTitle + '').toUpperCase(),
                                                            eventdate: item.incidentDate,
                                                            description: item.description,
                                                            url: urlTemplate
                                                        };
                                                    } else {
                                                        html = {
                                                            slug: '',
                                                            stripping: '',
                                                            na: 'n_a',
                                                            fontcolor: '',
                                                            pagetitle: '',
                                                            eventdate: '',
                                                            description: '',
                                                            url: ''
                                                        };
                                                    }
                                                    xhtml.push(html);
                                                });
                                            } else {
                                                var html = {
                                                    slug: '',
                                                    stripping: '',
                                                    na: 'n_a',
                                                    fontcolor: '',
                                                    pagetitle: '',
                                                    eventdate: '',
                                                    description: '',
                                                    url: ''
                                                };
                                                xhtml.push(html);
                                            }
                                            //xhtml.push(html);
                                            columnHtml[i] = xhtml;
                                            behavior[key].columnHtml = columnHtml;
                                            if (behavior[key].detailColumns.periods.length < 7) {
                                                for (var j = 7; j > behavior[key].detailColumns.periods.length; j--) {
                                                    behavior[key].detailColumns.periods.push("");
                                                }
                                            }
                                        }

                                    });
                                    behavior[key].columnHtml = columnHtml;

                                    $scope.attendanceBehavior.push(behavior[key]);
                                });
                            });
                        }

                        $scope.academicInfo = {
                            currentSchool: personal.enrollment.currentSchool || 'N/A',
                            expectedGraduationYear: personal.enrollment.expectedGraduationYear || 'N/A',
                            gradeLevel: personal.enrollment.gradeLevel || 'N/A',
                            languageSpokenAtHome: personal.languageHome || 'N/A',
                            iep: personal.ideaIndicator || 'N/A',
                            s504: personal.section504Status || 'N/A',
                            freeReducedLunch: (personal.eligibilityStatus && personal.enrollmentStatus) ? personal.enrollmentStatus : 'N/A'
                        };

                        $scope.transcripts = response.transcripts || {};
                        $scope.total_data = _.size(response.transcripts.subject);
                        $scope.transcripts.subjectOrder = [];
                        _.each($scope.transcripts.subject, function (item, key) {
                            $scope.transcripts.subjectOrder.push({name: key, value: item});
                        });
                        _.each($scope.transcripts.details, function (item) {
                            item.transcriptsOrder = [];
                            _.each(item.transcripts, function (i, k) {
                                item.transcriptsOrder.push({name: k, value: i});
                            });
                        });

                        $scope.xsreLastUpdated = response.lastUpdated;


                        angular.forEach(embedPrograms, function (v) {
                            var program = {
                                "years": new Date(v.participation_start_date).getFullYear(),
                                "name": v.program_name,
                                "start_date": v.participation_start_date,
                                "end_date": new Date(v.participation_end_date) >= Date.now() ? 'Present' : v.participation_end_date,
                                "active": v.active ? "Active" : "Inactive",
                                "cohorts": v.cohort
                            };
                            $scope.programs.push(program);
                        });
                        $scope.programs.sort(function (a, b) {
                            if (a.years >= b.years) {
                                return (-1);
                            }
                            return (1);
                        });

                        var yearPrograms = {};

                        for (var i = 0; i < $scope.programs.length; i++) {
                            var program = $scope.programs[i];
                            
                            if (Object.keys(yearPrograms).indexOf(program.years) === -1) {
                                yearPrograms[program.years] = [];
                            }
                            yearPrograms[program.years].push(program);
                        }

                        angular.forEach(yearPrograms, function (items, year) {
                            $scope.list_programs.push({
                                years: year,
                                programs: items
                            });
                        });

                    } else {

                        showError(response.error, 1);

                    }
                    $scope.loading_icon = true;
                    $('.loading-icon').addClass('hide');
                    $rootScope.doingResolve = false;
                })
                .error(function (response, status) {

                    $scope.loading_icon = true;
                    $('.loading-icon').addClass('hide');
                    showError(response.error, 1);
                    $rootScope.doingResolve = false;
                    if (status === 401) {
                        $rootScope.show_footer = false;
                        CookieStore.clearData();
                        $location.path('/login');
                    }

                });
        };

        getXsre();



        $scope.showDebug = function () {
            $window.open($window.location.origin + '/#/student/xsre/' + student_id);
        };

        /**
         * Update Now, remove cache and reload the page content
         */
        $scope.updateNow = function () {

            $http.delete(api_url + AuthenticationService.organization_id + '/students/' + student_id + '/xsre', {
                headers: {
                    'Authorization': 'Bearer ' + AuthenticationService.token
                }
            })
                .success(function () {
                    getXsre();
                })
                .error(function (response, status) {

                    $scope.loading_icon = true;
                    $('.loading-icon').addClass('hide');
                    showError(response.error, 1);
                    $rootScope.doingResolve = false;
                    if (status === 401) {
                        $rootScope.show_footer = false;
                        CookieStore.clearData();
                        $location.path('/login');
                    }

                });
        };

    }]);
app.controller('StudentEditController', ['$rootScope', '$scope', '$routeParams', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $routeParams, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $scope.student = {};
        var schoolDistrict = {};
        var relationship = {};
        $scope.schoolDistricts = [];
        $scope.relationships = [];

        var student_id = $routeParams.student_id;

        $.each(schoolDistricts, function (key, value) {
            schoolDistrict = {
                "id": key,
                "name": value
            };
            $scope.schoolDistricts.push(schoolDistrict);
        });
        $.each(relationships, function (key, value) {
            relationship = {
                "id": key,
                "name": value
            };
            $scope.relationships.push(relationship);
        });

        $scope.editStudent = function (student) {
            if (student) {
                $scope.working = true;
                $http.put(api_url + AuthenticationService.organization_id + '/students/' + student_id, $.param(student), {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function (response) {

                        if (response.success === true) {
                            showError(response.message, 2);
                            $location.path('/student');
                        } else {
                            showError(response.message, 1);
                        }
                        $scope.working = false;

                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response.error, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }
        };

        $http.get(api_url + AuthenticationService.organization_id + '/students/' + student_id, {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {
                //                $.each(schoolDistricts, function (key, value) {
                //                    if (key == response.school_district) {
                //                        response.school_district = value;
                //                    }
                //                });
                $scope.student = response;
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response.error, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

    }
]);
app.controller('StudentProgramAddController', ['$rootScope', '$scope', '$routeParams', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $routeParams, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;

        var student_id = $routeParams.student_id;

        $scope.program = {
            active: true
        };

        $scope.addProgramStudent = function (program) {
            if (program) {
                $scope.working = true;
                $http.post(api_url + AuthenticationService.organization_id + '/students/' + student_id + '/programs', $.param(program), {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function (response) {
                        //console.log(response);
                        if (response.success === true) {
                            showError(response.message, 2);
                            $location.path('/login');

                        } else {
                            showError(response.error.message, 1);
                        }
                        $scope.working = false;

                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response.error, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }
        };

        $http.get(api_url + AuthenticationService.organization_id + '/students/' + student_id, {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                $scope.student = response;
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response.error, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

        $http.get(api_url + AuthenticationService.organization_id + '/tags', {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                var availableTags = [];
                for (var i = 0; i < response.data.length; i++) {
                    availableTags.push(response.data[i].name);
                }


                jQuery("#cohort").tagit({
                    availableTags: availableTags
                });


                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response.error, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

        $http.get(api_url + AuthenticationService.organization_id + '/programs', {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                if (response.success === true && response.total > 0) {
                    $scope.list_program = response.data;
                } else {
                    showError(response.error.message, 1);
                }
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response.error, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

    }
]);
app.controller('StudentProgramController', ['$rootScope', '$scope', '$routeParams', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $routeParams, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;

        var student_id = $routeParams.student_id;
        var list_program = [];

        $http.get(api_url + AuthenticationService.organization_id + '/students/' + student_id, {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                $scope.student = response;
                $rootScope.doingResolve = false;
            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response.error, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

        $http.get(api_url + AuthenticationService.organization_id + '/programs', {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                if (response.success === true && response.total > 0) {
                    list_program = response.data;

                    $http.get(api_url + AuthenticationService.organization_id + '/students/' + student_id + '/programs', {
                        headers: {
                            'Authorization': 'Bearer ' + AuthenticationService.token
                        }
                    })
                        .success(function (response) {

                            for (var i = 0; i < response.data.length; i++) {
                                for (var j = 0; j < list_program.length; j++) {
                                    if (response.data[i].program === list_program[j]._id) {
                                        response.data[i].name = list_program[j].name;
                                    }
                                }
                            }

                            $scope.programs = response.data;
                            $rootScope.doingResolve = false;
                        })
                        .error(function (response, status) {

                            //console.log(response);
                            //console.log(status);
                            showError(response.error, 1);
                            $rootScope.doingResolve = false;
                            if (status === 401) {
                                $rootScope.show_footer = false;
                                CookieStore.clearData();
                                $location.path('/login');
                            }

                        });

                } else {
                    showError(response.error.message, 1);
                }
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response.error, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

    }
]);
app.controller('StudentXSreController', ['$route','$rootScope', '$scope', '$routeParams', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($route,$rootScope, $scope, $routeParams, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        var student_id = $routeParams.student_id;
        $scope.refresh = false;
        $scope.snippet = "";
        $scope.editorOptions = {
            //lineWrapping : true,
            height: '500px',
            tabSize: 6,
            lineNumbers: true,
            readOnly: 'nocursor',
            theme: 'monokai',
            mode: 'xml'
        };


        $http.get(api_url + AuthenticationService.organization_id + '/students/' + student_id, {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                $scope.student = response;

                $http.get(api_url + AuthenticationService.organization_id + '/students/'+student_id+'/xsre.xml?raw=1', {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    },
                    timeout: 15000
                })
                    .success(function (xml) {
                        $scope.snippet = xml;
                        $scope.refresh = true;
                        $rootScope.doingResolve = false;
                    })
                    .error(function (response, status) {
                        $rootScope.doingResolve = false;
                        showError(response, 1);
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });

            })
            .error(function (response, status) {

                showError(response.error, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });
        //$scope.codemirrorLoaded = function(_editor){
        //    // Editor part
        //    var _doc = _editor.getDoc();
        //    _editor.focus();
        //
        //    // Options
        //    _editor.setOption('firstLineNumber', 1);
        //    _doc.markClean();
        //
        //    // Events
        //    _editor.on("beforeChange", function(codemirror){ codemirror.refresh(); });
        //    _editor.on("change", function(codemirror){ codemirror.refresh(); });
        //};

    }]);
app.controller('TagAddController', ['$rootScope', '$scope', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;

        $scope.addTag = function (tag) {
            if (tag) {
                //console.log(tag);
                $scope.working = true;
                $http.post(api_url + AuthenticationService.organization_id + '/tags', $.param(tag), {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function (response) {
                        if (response.success) {
                            showError(response.message, 2);
                            $scope.working = false;
                            $location.path('/tag');
                        } else {
                            showError(response.message, 1);
                            $scope.working = false;
                        }


                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }
        };

    }
]);
app.controller('TagController', ['$rootScope', '$scope', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $scope.tags = [];

        $scope.deleteTag = function (id, index) {

            if (id) {
                $scope.working = true;
                $http.delete(api_url + AuthenticationService.organization_id + '/tags/' + id, {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function (response) {
                        showError(response.message, 2);
                        $scope.tags.splice(index, 1);
                        $scope.working = false;
                        $location.path('/tag');

                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }
        };

        $http.get(api_url + AuthenticationService.organization_id + '/tags', {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                if (response.success === true && response.total > 0) {
                    $scope.tags = response.data;
                } else {
                    showError(response.error.message, 1);
                }
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

    }
]);
app.controller('TagEditController', ['$rootScope', '$scope', '$routeParams', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $routeParams, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;

        var tag_id = $routeParams.tag_id;

        $scope.editTag = function (tag) {
            if (tag) {
                tag.redirect_url = AuthenticationService.redirect_url;

                $scope.working = true;
                $http.put(api_url + AuthenticationService.organization_id + '/tags/' + tag_id, $.param(tag), {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function (response) {

                        showError(response.message, 2);
                        $scope.working = false;
                        $location.path('/tag');
                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }
        };

        $http.get(api_url + AuthenticationService.organization_id + '/tags/' + tag_id, {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                $scope.tag = response;
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

    }
]);
app.controller('UserAssignController', ['$rootScope', '$scope', '$routeParams', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $routeParams, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;

        var user_id = $routeParams.user_id;

        $scope.addUserStudent = function (student, index) {
            //console.log(user_id);
            //console.log(student);
            if (student) {
                $scope.working = true;
                $http.put(api_url + AuthenticationService.organization_id + '/users/' + user_id + '/students/' + student, {}, {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                }).success(function (response) {
                    //console.log(response);
                    $scope.working = false;
                    if (response.success) {
                        $scope.unassigned_students.splice(index, 1);
                        showError(response.message, 2);
                        $location.path('/user/assign/' + user_id);
                    } else {
                        showError(response.message, 1);
                    }

                })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }

        };


        $scope.deleteStudent = function (student_id, index) {
            $http.delete(api_url + AuthenticationService.organization_id + '/users/' + user_id + '/students/' + student_id, {
                headers: {
                    'Authorization': 'Bearer ' + AuthenticationService.token
                }
            })
                .success(function () {

                    $scope.assigned_students.splice(index, 1);
                    $scope.working = false;

                })
                .error(function (response, status) {

                    //console.log(response);
                    //console.log(status);
                    showError(response, 1);
                    $scope.working = false;
                    if (status === 401) {
                        $rootScope.show_footer = false;
                        CookieStore.clearData();
                        $location.path('/login');
                    }

                });
        };

        var user = {

            userId: user_id
        };

        $http.post(api_url + AuthenticationService.organization_id + '/students?unassigned=true', $.param(user), {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {
                //console.log(response.data);
                $scope.unassigned_students = response.data;
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

        $http.get(api_url + AuthenticationService.organization_id + '/users/' + user_id + '/students', {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {
                //console.log(response.data);
                $scope.assigned_students = response.data;
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

    }
]);
app.controller('UserController', ['$rootScope', '$scope', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $scope.users = [];
        $scope.deleteUser = function (id, index) {
            if (AuthenticationService.user_id === id) {
                showError('Cannot Remove your own data', 1);
            } else if ((AuthenticationService.role+'').indexOf('case-worker') !== -1) {
                showError($rootScope.lang.you_dont_have_any_permission_page, 1);
            } else if (id) {
                $scope.working = true;
                $http.delete(api_url + AuthenticationService.organization_id + '/users/' + id, {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function () {

                        $scope.users.splice(index, 1);
                        $scope.working = false;

                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }
        };

        $http.get(api_url + AuthenticationService.organization_id + '/users', {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                if (response.success === true && response.total > 0) {
                    $scope.users = response.data;
                } else {
                    showError(response.error.message, 1);
                }
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });



    }
]);
app.controller('UserDetailController', ['$rootScope', '$scope', '$routeParams', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $routeParams, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;

        var user_id = $routeParams.user_id;

        $http.get(api_url + AuthenticationService.organization_id + '/users/' + user_id, {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                $scope.user = response;
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

    }
]);
app.controller('UserEditController', ['$rootScope', '$scope', '$routeParams', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $routeParams, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;
        $scope.disable_select = false;
        var user_id = $routeParams.user_id;
        if (user_id === CookieStore.get('user_id')) {
            $scope.disable_select = true;
            $scope.working = true;
        }
        $scope.editUser = function (user) {
            if (user) {
                $scope.working = true;

                var passing_data = {
                    role: user.role
                };

                $http.put(api_url + AuthenticationService.organization_id + '/users/' + user_id, $.param(passing_data), {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .success(function (response) {

                        if (response.success === true) {
                            showError(response.message, 2);
                            $location.path('/user');
                        } else {
                            showError(response.message, 1);
                        }
                        $scope.working = false;

                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }
        };

        $http.get(api_url + AuthenticationService.organization_id + '/users/' + user_id, {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                var set_role = response.role;

                $scope.user = {
                    role: set_role,
                    first_name: response.first_name,
                    last_name: response.last_name,
                    full_name: response.full_name
                };
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

    }
]);
app.controller('UserGroupAddController', ['$rootScope', '$scope', '$routeParams', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $routeParams, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;

        var user_id = $routeParams.user_id;

        $scope.students = [];
        $scope.new_student = false;

        $scope.addUserStudent = function (student, new_student) {
            //console.log(student);
            //console.log(new_student);
            if (student) {
                $scope.working = true;
                if (new_student === true) {
                    $http.post(api_url + AuthenticationService.organization_id + '/users/' + user_id + '/students', $.param(student), {
                        headers: {
                            'Authorization': 'Bearer ' + AuthenticationService.token
                        }
                    }).success(function (response) {

                        $scope.working = false;
                        if (response.success) {
                            showError(response.message, 2);
                            $location.path('/user/group/' + user_id);
                        } else {
                            showError(response.message, 1);
                        }

                    })
                        .error(function (response, status) {

                            //console.log(response);
                            //console.log(status);
                            showError(response, 1);
                            $scope.working = false;
                            if (status === 401) {
                                $rootScope.show_footer = false;
                                CookieStore.clearData();
                                $location.path('/login');
                            }

                        });
                } else {
                    $http.put(api_url + AuthenticationService.organization_id + '/users/' + user_id + '/students/' + student.student_id, {}, {
                        headers: {
                            'Authorization': 'Bearer ' + AuthenticationService.token
                        }
                    }).success(function (response) {

                        $scope.working = false;
                        if (response.success) {
                            showError(response.message, 2);
                            $location.path('/user/group/' + user_id);
                        } else {
                            showError(response.message, 1);
                        }

                    })
                        .error(function (response, status) {

                            //console.log(response);
                            //console.log(status);
                            showError(response, 1);
                            $scope.working = false;
                            if (status === 401) {
                                $rootScope.show_footer = false;
                                CookieStore.clearData();
                                $location.path('/login');
                            }

                        });
                }
            }
        };

        $http.get(api_url + AuthenticationService.organization_id + '/users/' + user_id, {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                $scope.user = response;
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

        $http.get(api_url + AuthenticationService.organization_id + '/students', {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                if (response.success === true && response.total > 0) {
                    $scope.list_student = response.data;
                } else {
                    showError(response.error.message, 1);
                }
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

    }
]);
app.controller('UserGroupController', ['$rootScope', '$scope', '$routeParams', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $routeParams, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;
        if(!$scope.user){
            $scope.user = { full_name: "" };
        }

        var user_id = $routeParams.user_id;

        $scope.deleteStudent = function (student_id, index) {
            $http.delete(api_url + AuthenticationService.organization_id + '/users/' + user_id + '/students/' + student_id, {
                headers: {
                    'Authorization': 'Bearer ' + AuthenticationService.token
                }
            })
                .success(function () {

                    //console.log(response);
                    $scope.students.splice(index, 1);
                    $scope.working = false;

                })
                .error(function (response, status) {

                    //console.log(response);
                    //console.log(status);
                    showError(response, 1);
                    $scope.working = false;
                    if (status === 401) {
                        $rootScope.show_footer = false;
                        CookieStore.clearData();
                        $location.path('/login');
                    }

                });
        };

        $http.get(api_url + AuthenticationService.organization_id + '/users/' + user_id, {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                $scope.user = response;
                $rootScope.doingResolve = false;

            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

        $http.get(api_url + AuthenticationService.organization_id + '/users/' + user_id + '/students', {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                //console.log(response);
                if (response.success) {
                    $scope.students = response.data;
                    $rootScope.doingResolve = false;
                }


            })
            .error(function (response, status) {

                //console.log(response);
                //console.log(status);
                showError(response, 1);
                $rootScope.doingResolve = false;
                if (status === 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

    }
]);
app.controller('UserInviteController', ['$rootScope', '$scope', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $http, $location, AuthenticationService, CookieStore) {
        'use strict';
        $rootScope.full_screen = false;
        $rootScope.doingResolve = false;

        $scope.user = {
            role: 'case-worker-restricted'
        };


        $scope.inviteUser = function (user) {
            user.caseWorkerRestricted = !user.caseWorkerRestricted;

            if (user) {
                user.redirect_url = AuthenticationService.redirect_url;

                $scope.working = true;
                $http.post(auth_url + '/user/invite', $.param(user), {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })

                    .success(function (response) {
                        if (response.success === true) {
                            showError(response.message, 2);

                            $location.path('/user');
                        } else {
                            showError(response.message, 1);
                        }
                        $scope.working = false;

                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response, 1);
                        $scope.working = false;
                        if (status === 401) {
                            $rootScope.show_footer = false;
                            CookieStore.clearData();
                            $location.path('/login');
                        }

                    });
            }
        };

    }
]);
app.controller('LoadingController', [
    function () {
        'use strict';
    }
]);
app.filter('flattenRows', function () {
    'use strict';
    return function (transcriptTerm) {
        var flatten = [];
        var subrows = "";
        angular.forEach(transcriptTerm, function (row) {
            subrows = row.courses.course;
            flatten.push(row);
            if (subrows) {
                angular.forEach(subrows, function (subrow) {
                    flatten.push(angular.extend(subrow, {
                        subrow: true
                    }));
                });
            }
        });
        return flatten;

    };
});

app.filter('unique', function () {
    'use strict';
    return function (collection, keyname) {
        var output = [],
            keys = [];

        angular.forEach(collection, function (item) {
            var key = item[keyname];
            if (keys.indexOf(key) === -1) {
                keys.push(key);
                output.push(item);
            }
        });

        return output;
    };
});

app.filter('phonenumber', function () {
    'use strict';
    return function (number) {

        if (!number) {
            return '';
        }

        number = String(number);

        var formattedNumber = number;

        var c = (number[0] === '1') ? '1 ' : '';
        number = number[0] === '1' ? number.slice(1) : number;

        var area = number.substring(0, 3);
        var front = number.substring(3, 6);
        var end = number.substring(6, 10);

        if (front) {
            formattedNumber = (c + "(" + area + ") " + front);
        }
        if (end) {
            formattedNumber += ("-" + end);
        }
        return formattedNumber;
    };
});
app.directive('attendance', function(){
    'use strict';
    return {
        restrict: 'E',
        scope:{
            url:'@',
            slug:'@',
            stripping:'@',
            na:'@',
            fontcolor:'@',
            pagetitle:'@',
            eventdate:'@',
            description:'@'
        },
        template:'<div popover-template="url" popover-trigger="mouseenter" popover-placement="right" class="grid-item {{slug}} {{stripping}} {{na}}"></div>'

    };
});

app.directive('dropdownMultiselect', ["$document", function($document){
    'use strict';
    return {
        restrict: 'E',
        scope:{
            model: '=',
            options: '=',
            title:'@'
        },

        template: "<div class='multiselect'>"+
        "<button class='button filter-btn' ng-click='toggleSelect()'>{{title}}<span class='filter-caret caret'></span></button>"+
        "<ul  class='filter-btn popup' ng-show='isPopupVisible'>" +
        "<li class='list-dropdown-padding' data-ng-repeat='option in options' data-ng-click='setSelectedItem()'>{{option.name}}<span data-ng-class='isChecked(option.id)'></span></li>" +
        "</ul>" +
        "</div>",
        link:function(scope,element,attr){

            scope.isPopupVisible = false;
            scope.toggleSelect = function(){
                scope.isPopupVisible = !scope.isPopupVisible;
            };
            $document.bind('click', function(event){
                var isClickedElementChildOfPopup = element
                        .find(event.target)
                        .length > 0;

                if (isClickedElementChildOfPopup)
                {return;}

                scope.isPopupVisible = false;
                scope.$apply();
            });
        },
        controller: ["$scope", function($scope){
            $scope.setSelectedItem = function(){
                var id = this.option.id;
                if (_.contains($scope.model, id)) {
                    $scope.model = _.without($scope.model, id);
                } else {
                    $scope.model.push(id);
                }
                return false;
            };
            $scope.isChecked = function (id) {
                if (_.contains($scope.model, id)) {
                    return 'icon-ok pull-right';
                }
                return false;
            };
        }]
    };
}]);

app.directive('ngConfirmClick', [
    function () {
        'use strict';
        return {
            link: function (scope, element, attr) {
                var msg = attr.ngConfirmClick || "Are you sure?";
                var clickAction = attr.confirmedClick;
                element.bind('click', function (event) {
                    if (window.confirm(msg)) {
                        scope.$eval(clickAction);
                    }
                });
            }
        };
    }]);

app.directive('contenteditable', function () {
    'use strict';
    return {
        require: 'ngModel',
        link: function (scope, elm, attrs, ctrl) {
            // view -> model
            var clickAction = attrs.confirmedAction;
            elm.bind('blur', function () {
                var html = elm.html();
                scope.$apply(function () {
                    ctrl.$setViewValue(elm.html());
                });
                elm.html(html);
                scope.$eval(clickAction);
            });

            ctrl.render = function (value) {
                elm.html(value);
            };

            // load init value from DOM
            ctrl.$setViewValue(elm.html());

            elm.bind('keydown', function (event) {
                var esc = event.which === 27,
                    el = event.target;

                if (esc) {
                    ctrl.$setViewValue(elm.html());
                    el.blur();
                    event.preventDefault();
                }

            });

        }
    };
});

app.directive(
    "bnDocumentClick",
    ["$document", "$parse", function( $document, $parse ){
        'use strict';
        var linkFunction = function( $scope, $element, $attributes ){

            var scopeExpression = $attributes.bnDocumentClick;

            var invoker = $parse( scopeExpression );

            $document.on(
                "click",
                function( event ){

                    $scope.$apply(
                        function(){

                            invoker(
                                $scope,
                                {
                                    $event: event
                                }
                            );
                        }
                    );
                }
            );

        };
        // Return the linking function.
        return( linkFunction );
    }]
);

app.directive('phonenumberDirective', ['$filter', function ($filter) {
    'use strict';
    function link(scope, element, attributes) {
        'use strict';
        // scope.inputValue is the value of input element used in template
        scope.inputValue = scope.phonenumberModel;

        scope.$watch('inputValue', function (value, oldValue) {

            value = String(value);
            var number = value.replace(/[^0-9]+/g, '');
            scope.phonenumberModel = number;
            scope.inputValue = $filter('phonenumber')(number);
        });
    }

    return {
        link: link,
        restrict: 'E',
        scope: {
            phonenumberPlaceholder: '=placeholder',
            phonenumberModel: '=model'
        },
        //templateUrl: '/static/phonenumberModule/template.html',
        template: '<input ng-model="inputValue" type="tel" class="phonenumber form-control" placeholder="{{phonenumberPlaceholder}}" title="Phonenumber (Format: (999) 9999-9999)">'
    };
}]);

app.directive('resize', ["$window", function ($window) {
    'use strict';
    return function (scope, element) {
        var w = angular.element($window);
        scope.getWindowDimensions = function () {
            return {
                'h': w.height(),
                'w': w.width()
            };
        };
        scope.$watch(scope.getWindowDimensions, function (newValue, oldValue) {
            scope.windowHeight = newValue.h;
            scope.windowWidth = newValue.w;
            if (w.innerWidth < 767) {
                $rootScope.loginClass = "col-md-offset-4 col-md-5 login-page-mobile";
                $rootScope.data_content = "asset/templates/mobile.html";

            } else if (w.innerWidth > 767) {
                $rootScope.loginClass = "col-md-offset-4 col-md-5 login-page";
                $rootScope.data_content = "asset/templates/desktop.html";
            }

        }, true);

        w.bind('resize', function () {
            scope.$apply();
        });
    };
}]);

app.directive('a', function () {
    'use strict';
    return {
        restrict: 'E',
        link: function (scope, elem, attrs) {
            if (attrs.ngClick || attrs.href === '' || attrs.href === '#') {
                elem.on('click', function (e) {
                    e.preventDefault();
                });
            }
        }
    };
});

app.directive('listItem',function(){
    'use strict';
    return {
        restrict: 'E',
        scope:{
            data:'=',
            slug:'=',
            event:'=',
            title:'='
        },

        template:'<div class="grid-item {{slug}}" tooltip-html="data"></div>'


    };


});

app.directive('datepicker', function () {
    'use strict';
    return {
        restrict: 'E',
        transclude: true,
        scope: {
            date: '='
        },
        link: function (scope, element, attrs) {
            element.datepicker({
                dateFormat: 'mm/dd/yy',
                onSelect: function (dateText, datepicker) {
                    scope.date = dateText;
                    scope.$apply();
                }
            });
        },
        template: '<input type="text" class="form-control" ng-model="date"/>',
        replace: true
    };

});

app.factory('AuthenticationService', function () {
    'use strict';
    var auth = {
        isAuthenticated: false,
        token: null,
        refresh_token: null,
        organization_id: null,
        redirect_url: null,
        user_id: null,
        email: null,
        name: null,
        role: null,
        keep_email: false
    };

    return auth;

});

app.factory('CookieStore', ["$rootScope", "$http", "$window", "$cookieStore", "$location", "AuthenticationService", function ($rootScope, $http, $window, $cookieStore, $location, AuthenticationService) {
    'use strict';
    var prefix = 'cboAdmin_cookie_';
    var expire_in = null;
    return {
        /**
         *
         * @param name
         * @param value
         */
        put: function (name, value) {
//            console.log('SET COOKIE: ', prefix + name, value, expire_in);
            $cookieStore.put(prefix + name, value);
        },
        /**
         *
         * @param name
         * @returns {*|Object}
         */
        get: function (name) {
            return $cookieStore.get(prefix+name);
        },
        /**
         *
         * @param name
         * @returns {boolean}
         */
        has: function(name){
            return angular.isDefined($cookieStore.get(prefix+name));
        },
        /**
         *
         * @param value
         */
        put_remember: function (value) {
            $cookieStore.put('remember', value);
        },
        /**
         *
         * @param name
         */
        remove: function (name) {
            $cookieStore.remove(prefix+name);
        },
        /**
         *
         * @param token
         * @param refresh_token
         * @param organization_id
         * @param redirect_url
         * @param user_id
         * @param email
         * @param name
         * @param role
         * @param organization_name
         * @param expirein
         */
        setData: function (token, refresh_token, organization_id, redirect_url, user_id, email, name, role, organization_name, expirein) {
            if(expirein) {expire_in = expirein;}
            this.put('token', token, expirein);
            this.put('refresh_token', refresh_token);

            AuthenticationService.isAuthenticated = true;
            AuthenticationService.token = token;
            AuthenticationService.refresh_token = refresh_token;
            AuthenticationService.organization_id = organization_id;
            AuthenticationService.redirect_url = redirect_url;
            AuthenticationService.user_id = user_id;
            AuthenticationService.email = email;
            AuthenticationService.name = name;
            AuthenticationService.role = role;
            AuthenticationService.organization_name = organization_name;
            $rootScope.showNavBar = true;
            $rootScope.completeName = AuthenticationService.name;

        },
        getData: function () {
            var me = this;
            if (this.has('token') && this.get('token')) {

                var token = this.get('token');
                var refresh_token = this.get('refresh_token');
                var last_url = $location.url();

                $http.get(api_url + 'user', {
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                })
                    .success(function (response) {

                        $http.get(api_url + 'organizations', {
                            headers: {
                                'Authorization': 'Bearer ' + token
                            }
                        })
                            .success(function (responseClient) {

                                var get_hosting_name = $location.host();
                                var grand_access = false;
                                var get_id = false;
                                var get_redirect_url = false;
                                var organization_name = '';

                                if (responseClient.success === true && responseClient.total > 0) {
                                    $rootScope.organization_name = responseClient.data.name;
                                    for (var i = 0; i < responseClient.total; i++) {
                                        if (__i || get_hosting_name === responseClient.data[i].url) {
                                            grand_access = true;
                                            get_id = responseClient.data[i]._id;
                                            get_redirect_url = responseClient.data[i].url;
                                            var myEl = angular.element(document.querySelector('body'));
                                            myEl.addClass('cbp-spmenu-push');
                                            organization_name = responseClient.data[i].name;
                                        }
                                    }
                                }

                                if (grand_access) {
                                    $http.get(api_url + get_id + '/users', {
                                        headers: {
                                            'Authorization': 'Bearer ' + token
                                        }
                                    })
                                        .success(function (responseUser) {
                                            if (responseUser.success === true && responseUser.total > 0) {
                                                var find = false;
                                                var data = responseUser.data;
                                                var id = false;
                                                var complete_name = '';
                                                var role = 'case-worker-restricted';
                                                for (var i = 0; i < responseUser.total; i++) {
                                                    if (data[i].email === response.email) {
                                                        id = data[i]._id;
                                                        if (typeof data[i].first_name !== 'undefined' && data[i].first_name) {
                                                            complete_name += data[i].first_name + ' ';
                                                        }
                                                        if (typeof data[i].last_name !== 'undefined' && data[i].last_name) {
                                                            complete_name += data[i].last_name;
                                                        }

                                                        role = data[i].role;

                                                        if (role === 'admin') {
                                                            $rootScope.users_link = true;
                                                            $rootScope.tags_link = true;
                                                        } else {
                                                            $rootScope.users_link = false;
                                                            $rootScope.tags_link = false;
                                                        }
                                                        $rootScope.completeName = complete_name;
                                                        find = true;
                                                    }
                                                }
                                                if (find) {

                                                    global_redirect_url = get_redirect_url;

                                                    AuthenticationService.isAuthenticated = true;
                                                    AuthenticationService.token = token;
                                                    AuthenticationService.refresh_token = refresh_token;
                                                    AuthenticationService.organization_id = get_id;
                                                    AuthenticationService.redirect_url = get_redirect_url;
                                                    AuthenticationService.user_id = id;
                                                    AuthenticationService.email = response.email;
                                                    AuthenticationService.name = complete_name;
                                                    AuthenticationService.role = role;
                                                    AuthenticationService.organization_name = organization_name;

                                                    $rootScope.showNavBar = true;
                                                    $rootScope.completeName = AuthenticationService.name;

                                                    $location.path(last_url);

                                                    return true;

                                                }
                                                else
                                                {
                                                    $location.path('/login');
                                                    return false;
                                                }

                                            }
                                            else
                                            {
                                                $location.path('/login');
                                                return false;
                                            }

                                        })
                                        .error(function () {
                                            $location.path('/login');
                                            return false;
                                        });

                                }
                                else
                                {
                                    $location.path('/login');
                                    return false;
                                }

                            })
                            .error(function () {

                                AuthenticationService.email = null;
                                AuthenticationService.isAuthenticated = false;
                                AuthenticationService.token = null;
                                AuthenticationService.refresh_token = null;
                                AuthenticationService.organization_id = null;
                                AuthenticationService.redirect_url = null;
                                AuthenticationService.user_id = null;
                                AuthenticationService.name = null;
                                AuthenticationService.role = null;
                                $rootScope.showNavBar = false;
                                $rootScope.completeName = false;
                                $location.path('/login');
                                return false;

                            });

                    })
                    .error(function () {

                        AuthenticationService.email = null;
                        AuthenticationService.isAuthenticated = false;
                        AuthenticationService.token = null;
                        AuthenticationService.refresh_token = null;
                        AuthenticationService.organization_id = null;
                        AuthenticationService.redirect_url = null;
                        AuthenticationService.user_id = null;
                        AuthenticationService.name = null;
                        AuthenticationService.role = null;
                        $rootScope.showNavBar = false;
                        $rootScope.completeName = false;
                        $location.path('/login');
                        return false;

                    });


            } else {

                AuthenticationService.email = null;
                AuthenticationService.isAuthenticated = false;
                AuthenticationService.token = null;
                AuthenticationService.refresh_token = null;
                AuthenticationService.organization_id = null;
                AuthenticationService.redirect_url = null;
                AuthenticationService.user_id = null;
                AuthenticationService.name = null;
                AuthenticationService.role = null;
                $rootScope.showNavBar = false;
                $rootScope.completeName = false;
                $location.path('/login');
                return false;
            }
        },
        checkCookie: function () {
            if (this.has('token') && this.get('token')) {
                return true;
            }
            else
            {
                return false;
            }
        },
        clearData: function () {

            var remember = this.get('remember');
            if (remember !== true) {
                this.remove('email');
                AuthenticationService.email = null;
            }

            this.remove('token');
            this.remove('refresh_token');

            AuthenticationService.isAuthenticated = false;
            AuthenticationService.token = null;
            AuthenticationService.refresh_token = null;
            AuthenticationService.organization_id = null;
            AuthenticationService.redirect_url = null;
            AuthenticationService.user_id = null;
            AuthenticationService.name = null;
            AuthenticationService.role = null;
            $rootScope.showNavBar = false;
            $rootScope.completeName = false;

            stop_time_idle();

            return true;
        }
    };
}]);

app.factory('myGoogleAnalytics', [
    '$rootScope', '$window', '$location',
    function ($rootScope, $window, $location) {
'use strict';
        var myGoogleAnalytics = {};

        /**
         * Set the page to the current location path
         * and then send a pageview to log path change.
         */
        myGoogleAnalytics.sendPageview = function () {
            if ($window.ga) {
                $window.ga('set', 'page', $location.path());
                $window.ga('send', 'pageview');
            }
        };

        // subscribe to events
        $rootScope.$on('$viewContentLoaded', myGoogleAnalytics.sendPageview);

        return myGoogleAnalytics;
    }
]);
