angular.module('ng-clamp', [])
  .constant('$clamp', $clamp)
  .directive('ngClamp', ['$clamp', '$timeout', function($clamp, $timeout) {
    function link(scope, element, attrs) {
      var nbLines = parseInt(attrs.ngClamp, 10),
          originalText = null;
      //	Watching binded variable on the same element which is clamped
      if (!attrs.ngBind) {
        // scope.$watch(attrs.ngBind, clampElement);
        originalText = element.text();
      }

      //	Clamping text
      clampElement();

      function clampElement() {
        //	Async apply
        $timeout(function() {
          if (originalText === null)
			  element.text(scope.$eval(attrs.ngBind));
          else
            element.text(originalText);
          //	Calling Clamp.js method
          $clamp(element[0], {
            clamp: nbLines
          });
        });
      }

      scope.$on('resizeLayout', clampElement);
    }

    return {
      'restrict': 'A',
      'link': link
    };
  }]);
