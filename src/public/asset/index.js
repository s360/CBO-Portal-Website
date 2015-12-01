'use strict';

var is_logged_in = false;

var __i = false; if(typeof __local !== 'undefined') __i = __local;

var global_redirect_url = '/';

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

app.factory('headerInjector', [function (SessionService) {
    var headerInjector = {
        request: function (config) {
            config.headers['X-Cbo-Client-Url'] = __local;
            return config;
        }
    };
    return headerInjector;
}]);

app.config(['$httpProvider', function ($httpProvider) {
    //Reset headers to avoid OPTIONS request (aka preflight)
    $httpProvider.defaults.headers.common = {};
    $httpProvider.defaults.headers.get = {};
    $httpProvider.defaults.headers.post = {};
    $httpProvider.defaults.headers.put = {};
    $httpProvider.defaults.headers.patch = {};
    $httpProvider.defaults.headers.common['Content-Type'] = 'application/x-www-form-urlencoded';
    $httpProvider.defaults.headers.common['Accept'] = '*/*';
    if (__i) $httpProvider.interceptors.push('headerInjector');
    $httpProvider.defaults.timeout = 15000;

}]);

app.run(['$window', '$rootScope', '$route',
function ($window, $rootScope, locale) {
        $rootScope.goBack = function () {
            $window.history.back();
        };
        $rootScope.data_content = "asset/templates/desktop.html";
        var element = angular.element("#login-container");
        if ($window.innerWidth > 767) {
            $rootScope.loginClass = "col-md-offset-4 col-md-4 login-page";
            $rootScope.data_content = "asset/templates/desktop.html";
        } else if ($window.innerWidth < 767) {
            $rootScope.loginClass = "col-md-offset-4 col-md-4 login-page-mobile";
            $rootScope.data_content = "asset/templates/mobile.html";
        }

}]);



app.run(function ($state, $stateParams,$rootScope, $http, $location, $window, AuthenticationService, CookieStore, locale) {

    var returnData = CookieStore.getData();
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

        if (nextRoute != null && nextRoute.access != null && nextRoute.access.requiredAuthentication && !AuthenticationService.isAuthenticated && !$window.sessionStorage.token) {
            $location.path("/login");
            $rootScope.showNavBar = false;
        }

        if (nextRoute != null && nextRoute.access != null && nextRoute.access.requiredAdmin && (AuthenticationService.role+'').indexOf('case-worker') !== -1) {
            showError($rootScope.lang.you_dont_have_any_permission_page, 1);
            event.preventDefault();
        }

        if(nextRoute.$$route.originalPath != '/login' && $rootScope.doingResolve == true){
            $rootScope.showFooter = false;

        }

        if('$$route' in nextRoute){
            var intended_url = '';
            if(nextRoute.$$route.originalPath == '/login'){
                $rootScope.is_logged_in = false;
            }

            if(nextRoute.$$route.originalPath != '/login' && nextRoute.$$route.originalPath != '/forget'){
                $rootScope.is_logged_in = true;
                $rootScope.showFooter = true;


                intended_url = _.get(nextRoute.$$route, 'originalPath');
                if(intended_url == '/program/students/:program_id'){
                    intended_url = '/program/students/'+ _.get(nextRoute.params,'program_id');
                }else if(intended_url == '/student/backpacks/:student_id'){
                    intended_url = '/student/backpacks/'+_.get(nextRoute.params,'student_id');
                }else if(intended_url == '/student/detail/:student_id'){
                    intended_url = '/student/detail/'+_.get(nextRoute.params,'student_id');
                }else if(intended_url == '/student/detail/:student_id/:tab_id'){
                    intended_url = '/student/detail/'+_.get(nextRoute.params,'student_id')+'/'+_.get(nextRoute.params,'tab_id');
                }else if(intended_url == '/student/edit/:student_id'){
                    intended_url = '/student/edit/'+_.get(nextRoute.params,'student_id');
                }else if(intended_url =='/student/programs/:student_id/add'){
                    intended_url = '/student/programs/'+_.get(nextRoute.params,'student_id')+'/add';
                }else if(intended_url =='/student/programs/:student_id'){
                    intended_url = '/student/programs/'+_.get(nextRoute.params,'student_id');
                }else if(intended_url =='/program/detail/:program_id'){
                    intended_url = '/program/detail/'+_.get(nextRoute.params,'program_id');
                }else if(intended_url =='/program/edit/:program_id'){
                    intended_url = '/program/edit/'+_.get(nextRoute.params,'program_id');
                }else if(intended_url =='/program/students/:program_id/add'){
                    intended_url = '/program/students/'+_.get(nextRoute.params,'program_id')+'/add';
                }else if(intended_url =='/program/students/:program_id/edit/:student_id'){
                    intended_url = '/program/students/'+_.get(nextRoute.params,'program_id')+'/edit/'+_.get(nextRoute.params,'student_id');
                }else if(intended_url =='/program/students/:program_id'){
                    intended_url = '/program/students/'+_.get(nextRoute.params,'program_id');
                }else if(intended_url =='/tag/edit/:tag_id'){
                    intended_url = '/tag/edit/'+_.get(nextRoute.params,'tag_id');
                }else if(intended_url =='/user/group/:user_id/add'){
                    intended_url = '/user/group/'+_.get(nextRoute.params,'user_id')+'/add';
                }else if(intended_url =='/user/group/:user_id'){
                    intended_url = '/user/group/'+_.get(nextRoute.params,'user_id');
                }else if(intended_url =='/user/assign/:user_id'){
                    intended_url = '/user/assign/'+_.get(nextRoute.params,'user_id');
                }else if(intended_url =='/user/edit/:user_id'){
                    intended_url = '/user/edit/'+_.get(nextRoute.params,'user_id');
                }else if(intended_url =='/user/detail/:user_id'){
                    intended_url = '/user/detail/'+_.get(nextRoute.params,'user_id');
                }

                localStorage.setItem('intended_url',intended_url);
            }

        }
        if (returnData) {
            start_time_idle();
        }
        if($location.$$path == '/login'){
            $rootScope.showNavBar = false;
        }
    });
    $rootScope.$on('$stateChangeSuccess', function (event, toState, toParams, fromState) {
        $state.previous = fromState;
        //console.log(fromState);
    });
});


app.factory('AuthenticationService', function () {
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
/**
 *
 */
app.factory('CookieStore', function ($rootScope, $window, $cookieStore, AuthenticationService) {
    var prefix = 'cboAdmin_cookie_';
    var expire_in = null;
    return {
        /**
         *
         * @param name
         * @param value
         */
        put: function (name, value) {
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
            if(expirein) expire_in = expirein;
            this.put('token', token, expirein);
            this.put('refresh_token', refresh_token);
            this.put('organization_id', organization_id);
            this.put('redirect_url', redirect_url);
            this.put('user_id', user_id);
            this.put('email', email);
            this.put('name', name);
            this.put('role', role);
            this.put('organization_name', organization_name);

            AuthenticationService.isAuthenticated = true;
            AuthenticationService.token = this.get('token');
            AuthenticationService.refresh_token = this.get('refresh_token');
            AuthenticationService.organization_id = this.get('organization_id');
            AuthenticationService.redirect_url = this.get('redirect_url');
            AuthenticationService.user_id = this.get('user_id');
            AuthenticationService.email = this.get('email');
            AuthenticationService.name = this.get('name');
            AuthenticationService.role = this.get('role');
            AuthenticationService.organization_name = this.get('organization_name');
            $rootScope.showNavBar = true;
            $rootScope.completeName = AuthenticationService.name;

        },
        getData: function () {
            if (this.has('token') && this.get('token') && this.has('organization_id') && this.get('organization_id')) {
                AuthenticationService.isAuthenticated = true;
                AuthenticationService.token = this.get('token');
                AuthenticationService.refresh_token = this.get('refresh_token');
                AuthenticationService.organization_id = this.get('organization_id');
                AuthenticationService.redirect_url = this.get('redirect_url');
                AuthenticationService.user_id = this.get('user_id');
                AuthenticationService.email = this.get('email');
                AuthenticationService.name = this.get('name');
                AuthenticationService.role = this.get('role');
                $rootScope.showNavBar = true;
                $rootScope.completeName = AuthenticationService.name;
                return true;
            } else {
                var remember = this.get('remember');
                if (remember == true) {

                } else {
                    AuthenticationService.email = null;
                }

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
                return false;
            }
        },
        clearData: function () {

            var remember = this.get('remember');
            if (remember == true) {

            } else {
                this.remove('email');
                AuthenticationService.email = null;
            }

            this.remove('token');
            this.remove('refresh_token');
            this.remove('organization_id');
            this.remove('redirect_url');
            this.remove('user_id');
            this.remove('name');
            this.remove('role');
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
});

app.run(['$route', '$rootScope', '$location', function ($route, $rootScope, $location) {
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

function unique_array(){
    var newArr = [],
        origLen = origArr.length,
        found, x, y;

    for (x = 0; x < origLen; x++) {
        found = undefined;
        for (y = 0; y < newArr.length; y++) {
            if (origArr[x] === newArr[y]) {
                found = true;
                break;
            }
        }
        if (!found) {
            newArr.push(origArr[x]);
        }
    }
    return newArr;
}

app.factory('myGoogleAnalytics', [
    '$rootScope', '$window', '$location',
    function ($rootScope, $window, $location) {

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
            }

            // subscribe to events
            $rootScope.$on('$viewContentLoaded', myGoogleAnalytics.sendPageview);

            return myGoogleAnalytics;
    }
  ])
    .run([
    'myGoogleAnalytics',
    function (myGoogleAnalytics) {
            // inject self
    }
  ]);

function showError(message, alert) {
    var passingClass = 'alert-danger';
    if (alert == 2) {
        passingClass = 'alert-success'
    }
    var message_alert = '<div class="alert ' + passingClass + ' alert-dismissible" role="alert"><button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button>' + message + '</div>';
    if(message !== null) {
        if (window.location.href.indexOf('/login') == -1) {
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

function ucwords(str) {
    return (str + '').replace(/^([a-z])|\s+([a-z])/g, function ($1) {
        return $1.toUpperCase();
    });
}

function closed_sidebar() {
    var body = angular.element(document.querySelector('body'));
    var nav = angular.element(document.querySelector('#cbp-spmenu-s1'));
    var icon = angular.element(document.querySelector('#showLeftPush'));
    body.removeClass('cbp-spmenu-push-toright');
    nav.removeClass('cbp-spmenu-open');
    if (icon.hasClass('glyphicon glyphicon-remove')) {
        icon.removeClass('glyphicon glyphicon-remove');
        icon.addClass('glyphicon glyphicon-menu-hamburger');
    } else if (icon.hasClass('glyphicon glyphicon-menu-hamburger')) {
        icon.removeClass('glyphicon glyphicon-menu-hamburger');
        icon.addClass('glyphicon glyphicon-remove');
    }
}

function base64_encode(data) {

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
    session_timeout.login();
}

function stop_time_idle() {
    session_timeout.logout();
}