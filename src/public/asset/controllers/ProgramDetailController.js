app.controller('ProgramDetailController', ['$rootScope', '$scope', '$routeParams', '$http', '$location', 'AuthenticationService', 'CookieStore',
    function ($rootScope, $scope, $routeParams, $http, $location, AuthenticationService, CookieStore) {

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

                        //console.log(response);
                        //console.log(status);
                        showError(response, 1);
                        $scope.working = false;
                        if (status == 401) {
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
                        $location.path('/program')

                    })
                    .error(function (response, status) {

                        //console.log(response);
                        //console.log(status);
                        showError(response, 1);
                        $scope.working = false;
                        if (status == 401) {
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
                if (status == 401) {
                    $rootScope.show_footer = false;
                    CookieStore.clearData();
                    $location.path('/login');
                }

            });

    }
]);