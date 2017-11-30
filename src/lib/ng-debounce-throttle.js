/**
 * AngularJS module providing debounce and throttle.
 * Inspiration:
 * * https://github.com/shahata/angular-debounce
 * * https://github.com/BaggersIO/angular.throttle
 *
 * @module ngDebounceThrottle
 * @name ngDebounceThrottle
 * @ngdoc module
 */
/**
 * Service that creates and returns a new debounced version of the passed function, which will postpone its execution until after **delay** milliseconds have elapsed since the last time it was invoked. Useful for implementing behavior that should only happen *after* the input has stopped arriving. For example: recalculating a layout after the window has stopped being resized.
 * @ngdoc factory
 * @name $debounce
 * @module ngDebounceThrottle
 * @param callback {function} The function we want to debounce.
 * @param delay {number} Number of  milliseconds to wait before invoking the debounced function.
 * @param [leading=false] {boolean} If true, the function is triggered on the leading instead of the trailing edge of the **delay** interval. Useful for circumstances like preventing accidental double-clicks on a "submit" button from firing a second time. Default: `false`
 * @param [invokeApply=true] {boolean} If true, an angular digest cycle is triggered (see $timeout service for more details). Default: `true`
 * @return A debounced version of the passed function. Any arguments passed to this function will be also passed. The returned function also has a `cancel()` method, which can be used in case you want to reset the current debounce state. This will prevent the function from being triggered even after **delay** milliseconds have passed from last input. In case **leading** is `true`, the next user input will trigger the debounce.
 */
/**
 * Service that created and returns a new throttled verion of the passed function, which will trigger its execution only every **delay** milliseconds. This is useful to tear down fast iterative events, like `window.resize`.
 * @ngdoc factory
 * @name $throttle
 * @module ngDebounceThrottle
 * @param callback {function} The function we want to throttle.
 * @param delay {number} Number of milliseconds to wait between each input before invoking the function.
 * @param [leading=false] {boolean} If true, the function will be invoked at the startup. Default: `false`
 * @param [trailing=true] {boolean} If true, the function will be invoked at end of the operation. Default: `true`
 * @param [invokeApply=false] {boolean} If true, an an angular digest cycle is triggered each time the function is invoked. Default: `false`
 * @return A throttled version of the passed function. Any arguments passed to this function will be also passed. The returned function also has a `cancel()` method, which can be used in case you want to reset the current throttle stete. This will cause that the next input will trigger the function immediately.
 */
(function () {

	'use strict';

	function $debounce($rootScope, $timeout) {

		return function (callback, delay, leading, invokeApply) {

			var context, args, timeout, result;

			var later = function () {
				timeout = null;
				if (leading !== true) {
					if (invokeApply !== false) $rootScope.$applyAsync();
					result = callback.apply(context, args);
				}
			};

			function debounce() {

				context = this;
				args = arguments;

				var callNow = leading && !timeout;

				if (timeout)
					$timeout.cancel(timeout);

				timeout = $timeout(later, delay, false);

				if (callNow) {
					if (invokeApply !== false) $rootScope.$applyAsync();
					result = callback.apply(context, args);
				}

				return result;
			}

			debounce.cancel = function () {
				$timeout.cancel(timeout);
				timeout = null;
			};

			return debounce;
		};
	}

	function $throttle($rootScope, $timeout) {

		return function (callback, delay, leading, trailing, invokeApply) {

			var context, args, timeout, result;
			var previous = 0;

			var later = function () {
				previous = leading === false ? 0 : (new Date().getTime());
				timeout = null;

				if (invokeApply === true) $rootScope.$applyAsync();
				result = callback.apply(context, args);

				if (!timeout)
					context = args = null;
			};

			var throttled = function () {

				context = this;
				args = arguments;

				var now = (new Date().getTime());

				if (!previous && leading === false)
					previous = now;

				var remaining = delay - (now - previous);

				if (remaining <= 0 || remaining > delay) {
					if (timeout) {
						$timeout.cancel(timeout);
						timeout = null;
					}
					previous = now;

					if (invokeApply === true) $rootScope.$applyAsync();
					result = callback.apply(context, args);

					if (!timeout)
						context = args = null;
				}
				else if (!timeout && trailing !== false) {
					timeout = $timeout(later, remaining, false);
				}

				return result;
			};

			throttled.cancel = function () {
				$timeout.cancel(timeout);
				previous = 0;
				timeout = context = args = null;
			};

			return throttled;
		};
	}

	angular.module('ngDebounceThrottle', [])
		.factory('$debounce', ['$rootScope', '$timeout', $debounce])
		.factory('$throttle', ['$rootScope', '$timeout', $throttle]);

})();
