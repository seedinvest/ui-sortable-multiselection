angular.module('ui.sortable.multiselection', [])
  .constant('uiSortableMultiSelectionClass', 'ui-sortable-selected')
  .directive('uiSortableSelectable', [
    '$parse', 'uiSortableMultiSelectionClass',
    function($parse, selectedItemClass) {
      return {
        link: function(scope, element/*, attrs*/) {
          element.on('click', function (e) {
            var $this = angular.element(this);

            var $parent = $this.parent();
            var parentScope = $parent.scope();
            parentScope.sortableMultiSelect = parentScope.sortableMultiSelect || {};

            var lastIndex = parentScope.sortableMultiSelect.lastIndex;
            var index = $this.index();

            if (e.ctrlKey || e.metaKey) {
              $this.toggleClass(selectedItemClass);
              if ($this.attr('ui-sortable-selectable')) {
                if ($this.hasClass(selectedItemClass))
                  $parse($this.attr('ui-sortable-selectable')).assign($this.scope(), true);
                else
                  $parse($this.attr('ui-sortable-selectable')).assign($this.scope(), false);
              }
            } else if (e.shiftKey && lastIndex !== undefined && lastIndex >= 0) {
              if (index > lastIndex) {
                var elements = $parent.children().slice(lastIndex, index + 1);
                elements.addClass(selectedItemClass);

                for (var i=0; i<elements.length; i++) {
                  if ($(elements[i]).attr('ui-sortable-selectable'))
                    $parse($(elements[i]).attr('ui-sortable-selectable')).assign($(elements[i]).scope(), true);
                }
              } else if(index < lastIndex) {
                var elements = $parent.children().slice(index, lastIndex);
                elements.addClass(selectedItemClass);
                for (var i=0; i<elements.length; i++) {
                  if ($(elements[i]).attr('ui-sortable-selectable'))
                    $parse($(elements[i]).attr('ui-sortable-selectable')).assign($(elements[i]).scope(), true);
                }
              }
            } else {
              var elements = $parent.children('.'+selectedItemClass).not($this);
              elements.removeClass(selectedItemClass);
              for (var i=0; i<elements.length; i++) {
                if ($(elements[i]).attr('ui-sortable-selectable'))
                  $parse($(elements[i]).attr('ui-sortable-selectable')).assign($(elements[i]).scope(), false);
              }
              /*$this.toggleClass(selectedItemClass);
              if ($this.attr('ui-sortable-selectable')) {
                if ($this.hasClass(selectedItemClass))
                  $parse($this.attr('ui-sortable-selectable')).assign($this.scope(), true);
                else
                  $parse($this.attr('ui-sortable-selectable')).assign($this.scope(), false);
              }*/
            }
            parentScope.sortableMultiSelect.lastIndex = index;
          });
        }
      };
    }
  ])
  .factory('uiSortableMultiSelectionMethods', [
    '$parse', 'uiSortableMultiSelectionClass',
    function ($parse, selectedItemClass) {
      function fixIndex (oldPosition, newPosition, x) {
        if (oldPosition < x && (newPosition === undefined || (oldPosition < newPosition && x <= newPosition))) {
          return x - 1;
        } else if (x < oldPosition && newPosition !== undefined && newPosition < oldPosition && newPosition <= x) {
          return x + 1;
        }
        return x;
      }

      function groupIndexes (indexes, oldPosition, newPosition) {
        var above = [],
            below = [];

        for (var i = 0; i < indexes.length; i++) {
          var x = indexes[i];
          if (x < oldPosition) {
            above.push(fixIndex(oldPosition, newPosition, x));
          } else if (oldPosition < x) {
            below.push(fixIndex(oldPosition, newPosition, x));
          }
        }

        return {
          above: above,
          below: below
        };
      }

      function extractModelsFromIndexes (ngModel, indexes) {
        var result = [];
        for (var i = indexes.length - 1; i >= 0; i--) {
          result.push(ngModel.splice(indexes[i], 1)[0]);
        }
        result.reverse();
        return result;
      }

      function extractGroupedModelsFromIndexes (ngModel, aboveIndexes, belowIndexes) {
        var models = {
          below: extractModelsFromIndexes(ngModel, belowIndexes),
          above: extractModelsFromIndexes(ngModel, aboveIndexes)
        };
        return models;
      }

      function combineCallbacks(first,second){
        if(second && (typeof second === 'function')) {
          return function(e, ui) {
            first(e, ui);
            second(e, ui);
          };
        }
        return first;
      }

      return {
        extendOptions: function (sortableOptions) {
          sortableOptions = sortableOptions || {};
          var result = angular.extend({}, this, sortableOptions);

          for (var prop in sortableOptions) {
            if (sortableOptions.hasOwnProperty(prop)) {
              if (this[prop]) {
                if (prop === 'helper') {
                  result.helper = this.helper;
                } else {
                  result[prop] = combineCallbacks(this[prop], sortableOptions[prop]);
                }
              }
            }
          }

          return result;
        },
        helper: function (e, item) {
          // when starting to sort an unhighlighted item ,
          // deselect any existing highlighted items
          if (!item.hasClass(selectedItemClass)) {
              item.addClass(selectedItemClass)
                .siblings()
                .removeClass(selectedItemClass);
              if (item.attr('ui-sortable-selectable'))
                $parse(item.attr('ui-sortable-selectable')).assign(item.scope(), true);
              var elements = item.siblings();
              for (var i=0; i<elements.length; i++) {
                if ($(elements[i]).attr('ui-sortable-selectable'))
                  $parse($(elements[i]).attr('ui-sortable-selectable')).assign($(elements[i]).scope(), false);
              }
          }

          var selectedElements = item.parent().children('.' + selectedItemClass);
          var selectedSiblings = item.siblings('.' + selectedItemClass);

          // indexes of the selected siblings
          var indexes = angular.element.map(selectedSiblings, function (element) {
            return angular.element(element).index();
          });

          item.sortableMultiSelect = {
            indexes: indexes
          };

          // Clone the selected items and to put them inside the helper
          var elements = selectedElements.clone();

          // like `helper: 'clone'` does, hide the dragged elements
          selectedSiblings.hide();

          // Create the helper to act as a bucket for the cloned elements
          var helperTag = item[0].tagName;
          var helper = angular.element('<' + helperTag + '/>');
          return helper.append(elements);
        },
        start: function(e, ui) {
          ui.item.sortableMultiSelect.sourceElement = ui.item.parent();
        },
        update: function(e, ui) {
          if (ui.item.sortable.received) {
            if (!ui.item.sortable.isCanceled()) {
              var scope = ui.item.sortable.droptarget.scope();

              scope.$apply(function () {
                var ngModel = scope.$eval(ui.item.sortable.droptarget.attr('ng-model')),
                    newPosition = ui.item.sortable.dropindex,
                    models = ui.item.sortableMultiSelect.moved;

                // add the models to the target list
                Array.prototype.splice.apply(
                  ngModel,
                  [newPosition+ 1, 0]
                  .concat(models.below));

                Array.prototype.splice.apply(
                  ngModel,
                  [newPosition, 0]
                  .concat(models.above));
              });
            } else {
              ui.item.sortableMultiSelect.sourceElement.find('> .' + selectedItemClass).show();
            }
          }
        },
        remove: function(e, ui) {
          if (!ui.item.sortable.isCanceled()) {
            var scope = ui.item.sortableMultiSelect.sourceElement.scope();

            scope.$apply(function () {
              var ngModel = scope.$eval(ui.item.sortableMultiSelect.sourceElement.attr('ng-model')),
                  oldPosition = ui.item.sortable.index;

              var indexes = groupIndexes(ui.item.sortableMultiSelect.indexes, oldPosition);

              // get the models and remove them from the original list
              // the code should run in reverse order,
              // so that the indexes will not break
              ui.item.sortableMultiSelect.moved = extractGroupedModelsFromIndexes(ngModel, indexes.above, indexes.below);
            });
          } else {
            ui.item.sortableMultiSelect.sourceElement.find('> .' + selectedItemClass).show();
          }
        },
        stop: function (e, ui) {
          var sourceElement = ui.item.sortableMultiSelect.sourceElement || ui.item.parent();
          if (!ui.item.sortable.received &&
             // ('dropindex' in ui.item.sortable) &&
             !ui.item.sortable.isCanceled()) {
            var ngModel = sourceElement.scope().$eval(sourceElement.attr('ng-model')),
                oldPosition = ui.item.sortable.index,
                newPosition = ui.item.sortable.dropindex;

            var draggedElementIndexes = ui.item.sortableMultiSelect.indexes;
            if (!draggedElementIndexes.length) {
              return;
            }

            if (newPosition === undefined) {
              newPosition = oldPosition;
            }

            var indexes = groupIndexes(draggedElementIndexes, oldPosition, newPosition);

            // get the model of the dragged item
            // so that we can locate its position
            // after we remove the co-dragged elements
            var draggedModel = ngModel[newPosition];

            // get the models and remove them from the list
            // the code should run in reverse order,
            // so that the indexes will not break
            var models = extractGroupedModelsFromIndexes(ngModel, indexes.above, indexes.below);

            // add the models to the list
            Array.prototype.splice.apply(
              ngModel,
              [ngModel.indexOf(draggedModel) + 1, 0]
              .concat(models.below));

            Array.prototype.splice.apply(
              ngModel,
              [ngModel.indexOf(draggedModel), 0]
              .concat(models.above));

            var elements = ui.item.parent().find('> .' + selectedItemClass)
            console.log(elements);
            for (var i=0; i<elements.length; i++) {
              if ($(elements[i]).attr('ui-sortable-selectable'))
                $parse($(elements[i]).attr('ui-sortable-selectable')).assign($(elements[i]).scope(), false);
            }
            ui.item.parent().find('> .' + selectedItemClass).removeClass('' + selectedItemClass).show();

          } else if (ui.item.sortable.isCanceled()) {
            sourceElement.find('> .' + selectedItemClass).show();
          }
        }
      };
    }]);
