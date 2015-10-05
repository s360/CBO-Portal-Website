'use strict';

/**
 * @ngdoc function
 * @name CboPortal.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the CboPortal
 */
angular.module('CboPortal')
  .controller('MainCtrl', function ($scope) {
    $scope.awesomeThings = [
      'HTML5 Boilerplate',
      'AngularJS',
      'Karma'
    ];
  });
