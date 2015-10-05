'use strict';

/**
 * @ngdoc function
 * @name CboPortal.controller:AboutCtrl
 * @description
 * # AboutCtrl
 * Controller of the CboPortal
 */
angular.module('CboPortal')
  .controller('AboutCtrl', function ($scope) {
    $scope.awesomeThings = [
      'HTML5 Boilerplate',
      'AngularJS',
      'Karma'
    ];
  });
