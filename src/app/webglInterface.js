// Schnittstelle zwischen Three.js-Scope und Seite
angular.module('uh4dApp').factory('webglInterface', ['$rootScope', '$anchorScroll', '$debounce',
	function($rootScope, $anchorScroll, $debounce) {
		
		var wi = {};
		
		// Funktionsaufrufe vom Controller bzw. von Directive
		wi.callFunc = {};
		DV3D.callFunc = wi.callFunc;
		
		// Einstellungen
		wi.viewportSettings = {
			shading: ['color', 'grey', 'transparent', 'onlyEdges', 'xray', 'Custom'],
			camera: ['Perspective', 'Top', 'Front', 'Back', 'Left', 'Right', 'Custom'],
			edges: true,
			ssao: 'aa'
		};
		wi.viewportSettings.shadingSel = wi.viewportSettings.shading[0];
		wi.viewportSettings.cameraSel = wi.viewportSettings.camera[0];
		
		wi.unsafeSettings = {};
		
		wi.categories = [];
		wi.activeCategory = null;
		
		wi.vPanel = {};
		wi.vPanel.expand = false;
		wi.vPanel.activeTab = 0;
		
		wi.vizSettings = {
			opacitySelected: 100,
			edges: true,
			edgesOpacity: 100,
			edgesColor: 100
		};

		wi.snapshot = { active: false, mode: 'paint', text: '', title: '', refObj: [], refSrc: [], screenshots: [] };
		wi.snapshot.paintOptions = {
			opacity: 1.0,
			color: 'rgba(255,255,0,1.0)', //'#ff0',
			backgroundColor: 'rgba(255,255,255,0.0)',
			lineWidth: 3,
			undo: true,
			imageSrc: false
		};
		
		wi.spatialize = {
			active: false,
			opacity: 50,
			image: null,
			fov: 35
		};
		
		wi.listProperties = {
			plans: {
				visible: true,
				opacity: 1
			},
			images: {
				visible: true,
				scale: 10,
				opacity: 1
			}
		};
		
		// Listen
		wi.objects = [];
		wi.layerList = [];
		wi.layers = [];
		wi.hierarchList = [];
		
		wi.selected = [];
		
		wi.plans = new DV3D.Collection();
		wi.spatialImages = new DV3D.Collection();
		//wi.spatialImages.setScale(10);

		var layerDict = {};
		
		wi.insertIntoLists = function(item) {
			var objentry = new wi.ObjectEntry(item);
			insertIntoHierarchList(objentry);
			insertIntoLayerList(objentry);
			$rootScope.$applyAsync();
		};
		
		wi.insertIntoPlanlist = function(item) {
			item.visible = true;
			item.selected = false;
			item.opacity = 1.0;
			wi.plans.push(item);
			$rootScope.$applyAsync();
		};
		
		wi.clearLists = function() {
			console.log('clearList');
			wi.layerLists = [];
			wi.layers = [];
			wi.hierarchList = [];
			//wi.plans = [];
		};
		
		wi.ObjectEntry = function(item) {
			this.id = item.id;
			this.name = item.name;
			this.title = item.title;
			this.type = item.type;
			this.layer = item.layer || 0;
			
			this.parent = item.parent || null;
			this.children = [];
			
			this.parentVisible = true;
			this.visible = true;
			this.selected = false;
			this.expand = false;
			this.opacity = 1.0;
			
			var scope = this;
			
			this.toggle = function() {
				scope.visible = !scope.visible;
				if(!scope.visible && scope.selected)
					wi.callFunc.selectObject(scope.id, false, true);
				wi.callFunc.toggleObject(scope, scope.visible);
			};
			this.select = function(event) {
				if(scope.visible && event)
					wi.callFunc.selectObject(scope.id, event.ctrlKey, false);
			};
			this.setOpacity = function(value) {
				wi.callFunc.setObjectOpacity(scope, value);
			};
			this.focus = function() {
				wi.callFunc.focusObject(scope.id);
			};
			this.showSources = function () {
				wi.callFunc.highlightSources(scope);
			}
		};
		
		function insertIntoHierarchList(item) {
			var parentItem = findHierarchyObject(wi.hierarchList, item.parent);
			if(parentItem !== undefined) {
				item.parent = parentItem;
				parentItem.children.push(item);
			}
			else {
				item.parent = null;
				wi.hierarchList.push(item);
			}
		}
		
		function insertIntoLayerList(item) {
			wi.layerList.push(item);
			if(item.layer in layerDict) {
				layerDict[item.layer].count++;
			}
			else {
				layerDict[item.layer] = {count: 1};
				wi.layers.push({name: item.layer, visible: true, expand: false});
			}
		}
		
		function findHierarchyObject(list, id) {
			for(var i=0, l=list.length; i<l; i++) {
				var child = list[i];
				if(child.id === id) return child;
				var object = findHierarchyObject(child.children, id);
				if(object !== undefined) return object;
			}
			return undefined;
		}
		
		function findPlanlistObject(id) {
			for(var i=0; i<wi.plans.length; i++) {
				if(wi.plans[i].id === id)
					return wi.plans[i];
			}
		}
		
		// selection
		wi.selectListEntry = function(id, userData) {
			var item = (userData.type === 'plan') ? findPlanlistObject(id) : findHierarchyObject(wi.hierarchList, id);
			if(item) {
				item.selected = true;
				wi.selected.push(userData);
				if(item.parent) expandParents(item.parent);
				//$anchorScroll.yOffset = 200;
				scrollToListEntry(item.id);

				$rootScope.$applyAsync();
			}
		};
		
		wi.deselectListEntry = function(id, userData) {
			var item = (userData.type === 'plan') ? findPlanlistObject(id) : findHierarchyObject(wi.hierarchList, id);
			if(item) {
				item.selected = false;
				wi.selected.splice(wi.selected.indexOf(userData), 1);
				$rootScope.$applyAsync();
			}
		};
		
		function expandParents(item) {
			item.expand = true;
			if(item.parent) expandParents(item.parent);
		}

		var scrollToListEntry = $debounce(function (id) {
			console.log('anchorScroll called', 'list'+id);
			$anchorScroll('list'+id);
		}, 200, true);
		// var scrollToListEntry = function (id) {
		// 	console.log('anchorScroll called', 'list'+id);
		// 	$anchorScroll('list'+id);
		// };
		
		return wi;
		
	}]);
	