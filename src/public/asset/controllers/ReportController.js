app.controller('ReportController', ['$rootScope', '$scope', '$http', '$location', 'AuthenticationService', 'CookieStore','$filter',
    function ($rootScope, $scope, $http, $location, AuthenticationService, CookieStore,$filter) {
        'use strict';

        $rootScope.full_screen = false;

        //report/students/school_district
        //report/students/grade
        //report/students/gender
        //report/students/race

        var colors = ["#7cb5ec", "#434348", "#90ed7d", "#f7a35c", "#8085e9", "#f15c80", "#e4d354", "#2b908f", "#f45b5b", "#91e8e1"];

        $scope.total_student = 0;
        $scope.total_school = 0;
        $scope.total_user = 0;

        $rootScope.doingResolve = false;

        $http.get(api_url + AuthenticationService.organization_id + '/report/filters', {
            headers: {
                'Authorization': 'Bearer ' + AuthenticationService.token
            }
        })
            .success(function (response) {

                var i, temp;

                $scope.programData = ["All Programs"];
                for(i=0; i<response.programs.length; i++)
                {
                    $scope.programData.push(response.programs[i]);
                }

                $scope.districtData = ["All District"];
                for(i=0; i<response.programs.length; i++)
                {
                    $scope.districtData.push(response.districts[i]);
                }

                $scope.cohortData = ["All Cohort"];
                for(i=0; i<response.programs.length; i++)
                {
                    $scope.cohortData.push(response.cohorts[i]);
                }

                $scope.caseloadData = ["All Case Load"];
                for(i=0; i<response.caseload.length; i++)
                {
                    $scope.cohortData.push(response.caseload[i]);
                }

                $scope.select_program = $scope.programData[0];
                $scope.select_district = $scope.districtData[0];
                $scope.select_cohort = $scope.cohortData[0];
                $scope.select_caseload = $scope.caseloadData[0];

                $scope.filterChart();

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


        $scope.filterChart = function() {

            var program = "";
            var district = "";
            var cohort = "";
            var caseload = "";

            if($scope.select_program !== "All Programs")
                program = $scope.select_program;

            if($scope.select_district !== "All District")
                district = $scope.select_district;

            if($scope.select_cohort !== "All Cohort")
                cohort = $scope.select_cohort;

            if($scope.select_caseload !== "All Case Load")
                caseload = $scope.select_caseload;

            var passing_string = '?program='+encodeURIComponent(program)+'&district='+encodeURIComponent(district)+'&cohort='+encodeURIComponent(cohort)+'&caseload='+encodeURIComponent(caseload);


            $http.get(api_url + AuthenticationService.organization_id + '/report/students/school_district'+passing_string, {
                headers: {
                    'Authorization': 'Bearer ' + AuthenticationService.token
                }
            })
                .success(function (response) {

                    console.log(response);

                    var temp_districts = [];
                    var temp_studentSchools = [];
                    var temp_container = [];
                    var temp;
                    $scope.total_school = 0;

                    for (var index in response)
                    {
                        if(typeof response[index].schoolDistrict !== "undefined")
                        {
                            var have = 0;
                            for (var index2 in temp_container)
                            {
                                if(temp_container[index2].name == response[index].schoolDistrict)
                                {
                                    have = 1;
                                    var temp_schools = [];
                                    temp = {
                                        name: response[index].schoolName,
                                        total: response[index].total
                                    };
                                    temp_schools = temp_container[index2].schools;
                                    temp_schools.push(temp);
                                    temp_container[index2].total += response[index].total;
                                    temp_container[index2].schools = temp_schools;

                                }
                            }

                            if(have == 0)
                            {
                                temp = {
                                    name: response[index].schoolDistrict,
                                    total: response[index].total,
                                    schools: [{
                                        name: response[index].schoolName,
                                        total: response[index].total
                                    }]
                                };

                                temp_container.push(temp);

                            }
                        }
                        /*

                        var color_number = district%9;
                        var temp;
                        if(typeof response[index].schoolDistrict !== "undefined")
                        {
                            var get_same = -1;
                            for (var index2 in temp_districts)
                            {
                                if(temp_districts[index2].name == response[index].schoolDistrict)
                                {
                                    get_same = index2;
                                }
                            }

                            $scope.total_school += response[index].total;

                            if(get_same >= 0)
                            {
                                temp_districts[get_same].y = temp_districts[get_same].y + response[index].total

                                temp = {
                                    color: temp_districts[get_same].color,
                                    name: response[index].schoolName,
                                    y: response[index].total
                                };

                                temp_studentSchools.push(temp);

                            }
                            else
                            {
                                temp = {
                                    color: colors[color_number],
                                    name: response[index].schoolDistrict,
                                    y: response[index].total
                                };

                                temp_districts.push(temp);

                                temp = {
                                    color: colors[color_number],
                                    name: response[index].schoolName,
                                    y: response[index].total
                                };

                                temp_studentSchools.push(temp);
                            }

                            if(get_same >= 0)
                            {
                                district++;
                            }

                        }*/

                    }

                    for (var index in temp_container)
                    {
                        var color_number = index%9;
                        temp = {
                            color: colors[color_number],
                            name: temp_container[index].name,
                            y: temp_container[index].total
                        };
                        temp_districts.push(temp);
                        for (var index2 in temp_container[index].schools)
                        {
                            temp = {
                                color: colors[color_number],
                                name: temp_container[index].schools[index2].name,
                                y: temp_container[index].schools[index2].total
                            };
                            temp_studentSchools.push(temp);
                            $scope.total_school++;
                        }
                    }

                    console.log(temp_districts);
                    console.log(temp_studentSchools);

                    $scope.districts = temp_districts;
                    $scope.studentSchools = temp_studentSchools;

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


            $http.get(api_url + AuthenticationService.organization_id + '/report/students/grade'+passing_string, {
                headers: {
                    'Authorization': 'Bearer ' + AuthenticationService.token
                }
            })
                .success(function (response) {

                    var temp_grade = [];

                    for (var index in response)
                    {
                        var color_number = index%9;
                        var temp;
                        if(typeof response[index].gradeLevel !== "undefined")
                        {
                            temp = {
                                color: colors[color_number],
                                name: response[index].gradeLevel,
                                y: response[index].total
                            };

                            temp_grade.push(temp);
                        }

                    }

                    $scope.grade = temp_grade;

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


            $http.get(api_url + AuthenticationService.organization_id + '/report/students/race'+passing_string, {
                headers: {
                    'Authorization': 'Bearer ' + AuthenticationService.token
                }
            })
                .success(function (response) {

                    var temp_ethnicity = [];
                    $scope.total_student = 0;

                    for (var index in response)
                    {
                        var color_number = index%9;
                        var temp;
                        if(typeof response[index].ethnicityName !== "undefined")
                        {
                            $scope.total_student += response[index].total;
                            temp = {
                                color: colors[color_number],
                                name: response[index].ethnicityName,
                                y: response[index].total
                            };

                            temp_ethnicity.push(temp);
                        }

                    }

                    $scope.ethnicity = temp_ethnicity;

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


            $http.get(api_url + AuthenticationService.organization_id + '/report/students/gender'+passing_string, {
                headers: {
                    'Authorization': 'Bearer ' + AuthenticationService.token
                }
            })
                .success(function (response) {

                    var temp_gender = [];

                    for (var index in response)
                    {
                        var color_number = index%9;
                        var temp;
                        if(typeof response[index].genderName !== "undefined")
                        {
                            temp = {
                                color: colors[color_number],
                                name: response[index].genderName,
                                y: response[index].total
                            };

                            temp_gender.push(temp);
                        }

                    }

                    $scope.gender = temp_gender;

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

        };

    }
]);