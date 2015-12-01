app.directive('attendance', function(){
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

    }
});

app.directive('dropdownMultiselect', function($document){
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
            }
            $document.bind('click', function(event){
                var isClickedElementChildOfPopup = element
                        .find(event.target)
                        .length > 0;

                if (isClickedElementChildOfPopup)
                    return;

                scope.isPopupVisible = false;
                scope.$apply();
            });
        },
        controller: function($scope){
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
        }
    }
});

app.directive('ngConfirmClick', [
    function () {
        return {
            link: function (scope, element, attr) {
                var msg = attr.ngConfirmClick || "Are you sure?";
                var clickAction = attr.confirmedClick;
                element.bind('click', function (event) {
                    if (window.confirm(msg)) {
                        scope.$eval(clickAction)
                    }
                });
            }
        };
    }])

app.directive('contenteditable', function () {
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

            // model -> view
            ctrl.render = function (value) {
                elm.html(value);
            };

            // load init value from DOM
            ctrl.$setViewValue(elm.html());

            elm.bind('keydown', function (event) {
                var esc = event.which == 27,
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
    function( $document, $parse ){
        // I connect the Angular context to the DOM events.
        var linkFunction = function( $scope, $element, $attributes ){
            // Get the expression we want to evaluate on the
            // scope when the document is clicked.
            var scopeExpression = $attributes.bnDocumentClick;
            // Compile the scope expression so that we can
            // explicitly invoke it with a map of local
            // variables. We need this to pass-through the
            // click event.
            //
            // NOTE: I ** think ** this is similar to
            // JavaScript's apply() method, except using a
            // set of named variables instead of an array.
            var invoker = $parse( scopeExpression );
            // Bind to the document click event.
            $document.on(
                "click",
                function( event ){
                    // When the click event is fired, we need
                    // to invoke the AngularJS context again.
                    // As such, let's use the $apply() to make
                    // sure the $digest() method is called
                    // behind the scenes.
                    $scope.$apply(
                        function(){
                            // Invoke the handler on the scope,
                            // mapping the jQuery event to the
                            // $event object.
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
            // TODO: Listen for "$destroy" event to remove
            // the event binding when the parent controller
            // is removed from the rendered document.
        };
        // Return the linking function.
        return( linkFunction );
    }
);

app.directive('phonenumberDirective', ['$filter', function ($filter) {
    /*
     Intended use:
     <phonenumber-directive placeholder='prompt' model='someModel.phonenumber'></phonenumber-directive>
     Where:
     someModel.phonenumber: {String} value which to bind only the numeric characters [0-9] entered
     ie, if user enters 617-2223333, value of 6172223333 will be bound to model
     prompt: {String} text to keep in placeholder when no numeric input entered
     */

    function link(scope, element, attributes) {

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
            phonenumberModel: '=model',
        },
        //templateUrl: '/static/phonenumberModule/template.html',
        template: '<input ng-model="inputValue" type="tel" class="phonenumber form-control" placeholder="{{phonenumberPlaceholder}}" title="Phonenumber (Format: (999) 9999-9999)">',
    };
}]);

app.directive('resize', function ($window) {
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
    }
});

app.directive('datepicker', function () {

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
    }

});

app.directive('a', function () {
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
