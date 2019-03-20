angular.module('uh4d.timeSlider', [])

.component('timeSlider', {

	templateUrl: 'components/uh4d.timeSlider/timeSlider.tpl.html',
	// template: '<svg></svg>',

	controller: ['$scope', '$element', '$rootScope', '$state', '$window', 'moment', 'Image', 'Utilities', function ($scope, $element, $rootScope, $state, $window, moment, Image, Utilities) {

		var $ctrl = this;
		
		var el, svg, container, tickContainer, iSpan,
			WIDTH, HEIGHT,
			timeScaleInit, timeScale,
			zoom,
			from, to, start, end,
			modelHandle,
			yearSpan,
			getDateYear = d3.timeFormat("%Y");
		
		$ctrl.$onInit = function () {
			el = $element.find('svg');
			svg = d3.select(el[0]);

			$ctrl.includeUndated = $state.params.undated ? $state.params.undated === 'true' : true;

			$scope.$on('resizeLayout', resize);
			angular.element($window).on('resize', resize);

			getDateExtent();
		};

		function getDateExtent() {
			Image.getDateExtent().$promise
				.then(function (result) {
					start = {
						date: new Date(result.from)
					};
					end = {
						date: new Date()
					};
					from = {
						date: $state.params.from ? Math.max(start.date, new Date($state.params.from)) : start.date,
						x: 0,
						element: null
					};
					to = {
						date: $state.params.to ? Math.min(end.date, new Date($state.params.to)) : end.date,
						x: 0,
						element: null
					};
					modelHandle = {
						date: $state.params.modelDate ? Math.min(end.date, Math.max(start.date, new Date($state.params.modelDate))) : new Date(start.date.getTime() + (end.date.getTime() - start.date.getTime()) / 2),
						x: 0,
						element: null
					};
					initSvg();

					$rootScope.$broadcast('timeSliderReady', moment(from.date).format('YYYY-MM-DD'), moment(to.date).format('YYYY-MM-DD'), moment(modelHandle.date).format('YYYY-MM-DD'), $ctrl.includeUndated);
				})
				.catch(function (reason) {
					Utilities.throwApiException('Image.getDateExtent() in timeSlider component', reason);
				});
		}

		function initSvg() {

			WIDTH = el.width();
			HEIGHT = el.height();

			svg.select('#alphaMask > rect')
				.attr('width', WIDTH)
				.attr('height', HEIGHT);

			zoom = d3.zoom()
				.scaleExtent([1,10])
				.translateExtent([[0,0],[WIDTH,0]])
				.on('zoom', function () {
					timeScale = d3.event.transform.rescaleX(timeScaleInit);
					draw();
				});

			timeScale = timeScaleInit = d3.scaleTime()
				.domain([start.date, end.date])
				.range([0, WIDTH])
				.clamp(false);

			container = svg.append('g')
				.attr('class', 'container')
				.call(zoom);

			container.append('rect')
				.attr('class', 'background')
				.attr('width', '100%')
				.attr('height', '100%');

			iSpan = container.append('rect')
				.attr('class', 'image-span')
				.attr('y', 15)
				.attr('height', 32)
				.call(d3.drag()
					.on('drag', function () {
						var width = parseFloat(iSpan.attr('width'));
						from.x = Math.min(Math.max(from.x + d3.event.dx, start.x), end.x - width);
						to.x = from.x + width;
						from.date = timeScale.invert(from.x);
						to.date = timeScale.invert(to.x);
						updateTimeSpan(false);
					})
					.on('end', triggerFilterByDate)
				);

			container.append('rect')
				.attr('class', 'track')
				.attr('x', 0)
				.attr('y', HEIGHT / 2 - 2)
				.attr('width', '100%')
				.attr('height', 3)
				.attr('mask', 'url(#alphaMask)');;

			from.element = container.append('g')
				.attr('class', 'from-handle');
			from.element.append('path')
				.attr('d', 'M 5 16 H 0 V 46 H 5');
			from.element.append('text')
				.attr('text-anchor', 'middle')
				.attr('x', 0)
				.attr('y', 12);
			from.element.append('rect')
				.attr('x', -10)
				.attr('width', 20)
				.attr('height', '100%')
				.call(d3.drag()
					.container(container.node())
					.on('drag', function () {
						from.x = Math.min(Math.max(d3.event.x, 0), to.x - yearSpan, WIDTH);
						from.date = timeScale.invert(from.x);
						updateTimeSpan(false);
					})
					.on('end', triggerFilterByDate)
				);
			to.element = container.append('g')
				.attr('class', 'to-handle');
			to.element.append('path')
				.attr('d', 'M -5 16 H 0 V 46 H -5');
			to.element.append('text')
				.attr('text-anchor', 'middle')
				.attr('x', 0)
				.attr('y', 12);
			to.element.append('rect')
				.attr('x', -10)
				.attr('width', 20)
				.attr('height', '100%')
				.call(d3.drag()
					.container(container.node())
					.on('drag', function () {
						to.x = Math.max(Math.min(d3.event.x, WIDTH), from.x + yearSpan, 0);
						to.date = timeScale.invert(to.x);
						updateTimeSpan(false);
					})
					.on('end', triggerFilterByDate)
				);

			modelHandle.element = container.append('g')
				.attr('class', 'obj-handle');
			modelHandle.element.append('path')
				.attr('d', 'M 0 16 V 46 M -4 46 H 4 M -4 16 H 4');
			modelHandle.element.append('text')
				.attr('text-anchor', 'middle')
				.attr('x', 0)
				.attr('y', 12);
			modelHandle.element.append('rect')
				.attr('x', -10)
				.attr('width', 20)
				.attr('height', '100%')
				.call(d3.drag()
					.container(container.node())
					.on('drag', function () {
						modelHandle.x = Math.max(Math.min(d3.event.x, WIDTH), 0);
						modelHandle.date = timeScale.invert(modelHandle.x);
						updateModelHandle(false);
					})
					.on('end', triggerFilterByDate)
				);

			tickContainer = container.append('g')
				.attr('class', 'tick-container')
				.attr('transform', 'translate(0,25)')
				.attr('mask', 'url(#alphaMask)');

			draw();
		}

		function draw() {
			yearSpan = timeScale(new Date(+timeScale.domain()[0]).setFullYear(timeScale.domain()[0].getFullYear() + 1));

			var tickAll = tickContainer.selectAll('g.tick')
				.data(timeScale.ticks(Math.floor(WIDTH / 50)));

			var tickEnter = tickAll.enter()
				.append('g')
				.attr('class', 'tick')
				.attr('transform', function (d) {
					return 'translate(' + timeScale(d) + ',0)';
				});
			tickEnter.append('line')
				.attr('y1', 0)
				.attr('y2', 6);
			tickEnter.append('text')
				.attr('y', 18)
				.attr('text-anchor', 'middle')
				.text(getDateYear);

			tickAll.transition().duration(0)
				.attr('transform', function (d) {
					return 'translate(' + timeScale(d) + ',0)';
				})
				.select('text')
				.text(getDateYear);

			tickAll.exit().remove();

			updateTimeSpan();
			updateModelHandle();
		}

		function updateTimeSpan(calcPosition) {
			if (calcPosition !== false) {
				// new x positions
				from.x = timeScale(from.date);
				to.x = timeScale(to.date);
				start.x = timeScale(start.date);
				end.x = timeScale(end.date);
			}

			var diff = to.x - from.x;

			// span rect
			iSpan.attr('x', from.x)
				.attr('width', diff);

			// from handle
			from.element.attr('transform', 'translate(' + from.x + ',0)');
			from.element.select('text')
				.attr('x', Math.min(WIDTH - from.x - 50, Math.max(-from.x + 17, Math.min( diff / 2, 17) - 17)))
				.text(getDateYear(from.date));

			// to handle
			to.element.attr('transform', 'translate(' + to.x + ',0)');
			to.element.select('text')
				.attr('x', Math.max(-to.x + 50, Math.min(WIDTH - to.x - 17, Math.max(-diff / 2, -17) + 17)))
				.text(getDateYear(to.date));
		}

		function updateModelHandle(calcPosition) {
			if (calcPosition !== false) {
				// new x positions
				modelHandle.x = timeScale(modelHandle.date);
			}

			modelHandle.element.attr('transform', 'translate(' + modelHandle.x + ',0)');
			modelHandle.element.select('text')
				.text(getDateYear(modelHandle.date));
		}

		function triggerFilterByDate() {
			$rootScope.$broadcast('filterByDate', moment(from.date).format('YYYY-MM-DD'), moment(to.date).format('YYYY-MM-DD'), moment(modelHandle.date).format('YYYY-MM-DD'), $ctrl.includeUndated);
		}

		function resize() {
			WIDTH = el.width();
			HEIGHT = el.height();

			svg.select('#alphaMask > rect')
				.attr('width', WIDTH)
				.attr('height', HEIGHT);

			zoom.translateExtent([[0,0],[WIDTH,0]]);
			timeScaleInit.range([0, WIDTH]);
			timeScale.range([0, WIDTH]);

			draw();
		}

		$ctrl.includeUndatedChanged = function () {
			triggerFilterByDate();
		};

		$ctrl.$onDestroy = function () {
			angular.element($window).off('resize', resize);
		};
		
	}]
	
});
