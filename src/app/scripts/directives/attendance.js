'use strict';

/**
 * @ngdoc directive
 * @name CboPortal.directive:attendance
 * @description
 * # attendance
 */
angular.module('CboPortal')
  .directive('attendance', function () {
    return {
      template: '<div></div>',
      restrict: 'E',
      link: function postLink(scope, element, attrs) {
        element.text('this is the attendance directive');
      }
    };
  });
