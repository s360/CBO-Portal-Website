app.
    factory('StudentServices', function ($http, $q,AuthenticationService) {
        return {
            init: function () {
                return $http.get(api_url + AuthenticationService.organization_id + '/students', {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .then(function (response) {
                        if (typeof response.data === 'object') {
                            return response.data;
                        } else {
                            return $q.reject(response.data);
                        }
                    },
                    function (response) {
                        return $q.reject(response.data);
                    });
            },
            delete: function (id) {
                return $http.delete(api_url + AuthenticationService.organization_id + '/students/' + id, {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    }
                })
                    .then(function (response) {
                        if (typeof response.data === 'object') {
                            return response.data;
                        } else {
                            return $q.reject(response.data);
                        }
                    },
                    function (response) {
                        return $q.reject(response.data);
                    });
            },
            pullxsre: function (student) {
                return  $http.get(api_url + AuthenticationService.organization_id + '/students/'+student._id+'?xsre=1', {
                    headers: {
                        'Authorization': 'Bearer ' + AuthenticationService.token
                    },
                    timeout: 15000
                })
                    .then(function (response) {

                        if (typeof response.data === 'object') {
                            return response.data;
                        } else {
                            return $q.reject(response.data);
                        }
                    },
                    function (response) {
                        return $q.reject(response.data);
                    });
            },
    }
    });