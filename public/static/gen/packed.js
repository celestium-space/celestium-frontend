(function (factory) {
  if (typeof define === "function" && define.amd) define(["jquery"], factory);
  else factory(jQuery);
})(function ($) {
  var utils = (function () {
      return {
        extend: function (target, source) {
          return $.extend(target, source);
        },
        addEvent: function (element, eventType, handler) {
          if (element.addEventListener)
            element.addEventListener(eventType, handler, false);
          else if (element.attachEvent)
            element.attachEvent("on" + eventType, handler);
          else
            throw new Error(
              "Browser doesn't support addEventListener or attachEvent"
            );
        },
        removeEvent: function (element, eventType, handler) {
          if (element.removeEventListener)
            element.removeEventListener(eventType, handler, false);
          else if (element.detachEvent)
            element.detachEvent("on" + eventType, handler);
        },
        createNode: function (html) {
          var div = document.createElement("div");
          div.innerHTML = html;
          return div.firstChild;
        },
      };
    })(),
    keys = { ESC: 27, TAB: 9, RETURN: 13, UP: 38, DOWN: 40 };
  function Autocomplete(el, options) {
    var noop = function () {},
      that = this,
      defaults = {
        autoSelectFirst: false,
        appendTo: "body",
        serviceUrl: null,
        lookup: null,
        onSelect: null,
        width: "auto",
        minChars: 1,
        maxHeight: 300,
        deferRequestBy: 0,
        params: {},
        formatResult: Autocomplete.formatResult,
        delimiter: null,
        zIndex: 9999,
        type: "GET",
        noCache: false,
        onSearchStart: noop,
        onSearchComplete: noop,
        containerClass: "autocomplete-suggestions",
        tabDisabled: false,
        dataType: "text",
        lookupFilter: function (suggestion, originalQuery, queryLowerCase) {
          return suggestion.value.toLowerCase().indexOf(queryLowerCase) !== -1;
        },
        paramName: "query",
        transformResult: function (response) {
          return response.suggestions;
        },
      };
    that.element = el;
    that.el = $(el);
    that.suggestions = [];
    that.badQueries = [];
    that.selectedIndex = -1;
    that.currentValue = that.element.value;
    that.intervalId = 0;
    that.cachedResponse = [];
    that.onChangeInterval = null;
    that.onChange = null;
    that.ignoreValueChange = false;
    that.isLocal = false;
    that.suggestionsContainer = null;
    that.options = $.extend({}, defaults, options);
    that.classes = {
      selected: "autocomplete-selected",
      suggestion: "autocomplete-suggestion",
    };
    that.initialize();
    that.setOptions(options);
  }
  Autocomplete.utils = utils;
  $.Autocomplete = Autocomplete;
  Autocomplete.formatResult = function (suggestion, currentValue) {
    var reEscape = new RegExp(
        "(\\" +
          [
            "/",
            ".",
            "*",
            "+",
            "?",
            "|",
            "(",
            ")",
            "[",
            "]",
            "{",
            "}",
            "\\",
          ].join("|\\") +
          ")",
        "g"
      ),
      pattern = "(" + currentValue.replace(reEscape, "\\$1") + ")";
    return (
      "<span>" +
      suggestion.value.replace(
        new RegExp(pattern, "gi"),
        "<strong>$1</strong>"
      ) +
      "</span>"
    );
  };
  Autocomplete.prototype = {
    killerFn: null,
    initialize: function () {
      var that = this,
        suggestionSelector = "." + that.classes.suggestion,
        selected = that.classes.selected,
        options = that.options,
        container;
      that.element.setAttribute("autocomplete", "off");
      that.killerFn = function (e) {
        if (
          $(e.target).closest("." + that.options.containerClass).length === 0
        ) {
          that.killSuggestions();
          that.disableKillerFn();
        }
      };
      if (!options.width || options.width === "auto")
        options.width = that.el.outerWidth();
      that.suggestionsContainer = Autocomplete.utils.createNode(
        '<div class="' +
          options.containerClass +
          '" style="position: absolute; display: none;"></div>'
      );
      container = $(that.suggestionsContainer);
      container.appendTo(options.appendTo).width(options.width);
      container.on("mouseover", suggestionSelector, function () {
        that.activate($(this).data("index"));
      });
      container.on("mouseout", function () {
        that.selectedIndex = -1;
        container.children("." + selected).removeClass(selected);
      });
      container.on("click", suggestionSelector, function () {
        that.select($(this).data("index"), false);
      });
      that.fixPosition();
      if (window.opera)
        that.el.on("keypress", function (e) {
          that.onKeyPress(e);
        });
      else
        that.el.on("keydown", function (e) {
          that.onKeyPress(e);
        });
      that.el.on("keyup", function (e) {
        that.onKeyUp(e);
      });
      that.el.on("blur", function () {
        that.onBlur();
      });
      that.el.on("focus", function () {
        that.fixPosition();
      });
    },
    onBlur: function () {
      this.enableKillerFn();
    },
    setOptions: function (suppliedOptions) {
      var that = this,
        options = that.options;
      utils.extend(options, suppliedOptions);
      that.isLocal = $.isArray(options.lookup);
      if (that.isLocal)
        options.lookup = that.verifySuggestionsFormat(options.lookup);
      $(that.suggestionsContainer).css({
        "max-height": options.maxHeight + "px",
        width: options.width + "px",
        "z-index": options.zIndex,
      });
    },
    clearCache: function () {
      this.cachedResponse = [];
      this.badQueries = [];
    },
    disable: function () {
      this.disabled = true;
    },
    enable: function () {
      this.disabled = false;
    },
    fixPosition: function () {
      var that = this,
        offset;
      if (that.options.appendTo !== "body") return;
      offset = that.el.offset();
      $(that.suggestionsContainer).css({
        top: offset.top + that.el.outerHeight() + "px",
        left: offset.left + "px",
      });
    },
    enableKillerFn: function () {
      var that = this;
      $(document).on("click", that.killerFn);
    },
    disableKillerFn: function () {
      var that = this;
      $(document).off("click", that.killerFn);
    },
    killSuggestions: function () {
      var that = this;
      that.stopKillSuggestions();
      that.intervalId = window.setInterval(function () {
        that.hide();
        that.stopKillSuggestions();
      }, 300);
    },
    stopKillSuggestions: function () {
      window.clearInterval(this.intervalId);
    },
    onKeyPress: function (e) {
      var that = this;
      if (
        !that.disabled &&
        !that.visible &&
        e.keyCode === keys.DOWN &&
        that.currentValue
      ) {
        that.suggest();
        return;
      }
      if (that.disabled || !that.visible) return;
      switch (e.keyCode) {
        case keys.ESC:
          that.el.val(that.currentValue);
          that.hide();
          break;
        case keys.TAB:
        case keys.RETURN:
          if (that.selectedIndex === -1) {
            that.hide();
            return;
          }
          that.select(that.selectedIndex, e.keyCode === keys.RETURN);
          if (e.keyCode === keys.TAB && this.options.tabDisabled === false)
            return;
          break;
        case keys.UP:
          that.moveUp();
          break;
        case keys.DOWN:
          that.moveDown();
          break;
        default:
          return;
      }
      e.stopImmediatePropagation();
      e.preventDefault();
    },
    onKeyUp: function (e) {
      var that = this;
      if (that.disabled) return;
      switch (e.keyCode) {
        case keys.UP:
        case keys.DOWN:
          return;
      }
      clearInterval(that.onChangeInterval);
      if (that.currentValue !== that.el.val())
        if (that.options.deferRequestBy > 0)
          that.onChangeInterval = setInterval(function () {
            that.onValueChange();
          }, that.options.deferRequestBy);
        else that.onValueChange();
    },
    onValueChange: function () {
      var that = this,
        q;
      clearInterval(that.onChangeInterval);
      that.currentValue = that.element.value;
      q = that.getQuery(that.currentValue);
      that.selectedIndex = -1;
      if (that.ignoreValueChange) {
        that.ignoreValueChange = false;
        return;
      }
      if (q.length < that.options.minChars) that.hide();
      else that.getSuggestions(q);
    },
    getQuery: function (value) {
      var delimiter = this.options.delimiter,
        parts;
      if (!delimiter) return $.trim(value);
      parts = value.split(delimiter);
      return $.trim(parts[parts.length - 1]);
    },
    getSuggestionsLocal: function (query) {
      var that = this,
        queryLowerCase = query.toLowerCase(),
        filter = that.options.lookupFilter;
      return {
        suggestions: $.grep(that.options.lookup, function (suggestion) {
          return filter(suggestion, query, queryLowerCase);
        }),
      };
    },
    getSuggestions: function (q) {
      var response,
        that = this,
        options = that.options;
      response = that.isLocal
        ? that.getSuggestionsLocal(q)
        : that.cachedResponse[q];
      if (response && $.isArray(response.suggestions)) {
        that.suggestions = response.suggestions;
        that.suggest();
      } else if (!that.isBadQuery(q)) {
        options.onSearchStart.call(that.element, q);
        options.params[options.paramName] = q;
        $.ajax({
          url: options.serviceUrl,
          data: options.params,
          type: options.type,
          dataType: options.dataType,
        }).done(function (txt) {
          that.processResponse(txt);
          options.onSearchComplete.call(that.element, q);
        });
      }
    },
    isBadQuery: function (q) {
      var badQueries = this.badQueries,
        i = badQueries.length;
      while (i--) if (q.indexOf(badQueries[i]) === 0) return true;
      return false;
    },
    hide: function () {
      var that = this;
      that.visible = false;
      that.selectedIndex = -1;
      $(that.suggestionsContainer).hide();
    },
    suggest: function () {
      if (this.suggestions.length === 0) {
        this.hide();
        return;
      }
      var that = this,
        formatResult = that.options.formatResult,
        value = that.getQuery(that.currentValue),
        className = that.classes.suggestion,
        classSelected = that.classes.selected,
        container = $(that.suggestionsContainer),
        html = "";
      $.each(that.suggestions, function (i, suggestion) {
        html +=
          '<div class="' +
          className +
          '" data-index="' +
          i +
          '">' +
          formatResult(suggestion, value) +
          "</div>";
      });
      container.html(html).show();
      that.visible = true;
      if (that.options.autoSelectFirst) {
        that.selectedIndex = 0;
        container.children().first().addClass(classSelected);
      }
    },
    verifySuggestionsFormat: function (suggestions) {
      if (suggestions.length && typeof suggestions[0] === "string")
        return $.map(suggestions, function (value) {
          return { value: value, data: null };
        });
      return suggestions;
    },
    processResponse: function (text) {
      var that = this,
        response = typeof text == "string" ? $.parseJSON(text) : text;
      response.suggestions = that.verifySuggestionsFormat(
        that.options.transformResult(response)
      );
      if (!that.options.noCache) {
        that.cachedResponse[response[that.options.paramName]] = response;
        if (response.suggestions.length === 0)
          that.badQueries.push(response[that.options.paramName]);
      }
      if (
        true ||
        response[that.options.paramName] === that.getQuery(that.currentValue)
      ) {
        that.suggestions = response.suggestions;
        that.suggest();
      }
    },
    activate: function (index) {
      var that = this,
        activeItem,
        selected = that.classes.selected,
        container = $(that.suggestionsContainer),
        children = container.children();
      container.children("." + selected).removeClass(selected);
      that.selectedIndex = index;
      if (that.selectedIndex !== -1 && children.length > that.selectedIndex) {
        activeItem = children.get(that.selectedIndex);
        $(activeItem).addClass(selected);
        return activeItem;
      }
      return null;
    },
    select: function (i, shouldIgnoreNextValueChange) {
      var that = this,
        selectedValue = that.suggestions[i];
      if (selectedValue) {
        that.el.val(selectedValue);
        that.ignoreValueChange = shouldIgnoreNextValueChange;
        that.hide();
        that.onSelect(i);
      }
    },
    moveUp: function () {
      var that = this;
      if (that.selectedIndex === -1) return;
      if (that.selectedIndex === 0) {
        $(that.suggestionsContainer)
          .children()
          .first()
          .removeClass(that.classes.selected);
        that.selectedIndex = -1;
        that.el.val(that.currentValue);
        return;
      }
      that.adjustScroll(that.selectedIndex - 1);
    },
    moveDown: function () {
      var that = this;
      if (that.selectedIndex === that.suggestions.length - 1) return;
      that.adjustScroll(that.selectedIndex + 1);
    },
    adjustScroll: function (index) {
      var that = this,
        activeItem = that.activate(index),
        offsetTop,
        upperBound,
        lowerBound,
        heightDelta = 25;
      if (!activeItem) return;
      offsetTop = activeItem.offsetTop;
      upperBound = $(that.suggestionsContainer).scrollTop();
      lowerBound = upperBound + that.options.maxHeight - heightDelta;
      if (offsetTop < upperBound)
        $(that.suggestionsContainer).scrollTop(offsetTop);
      else if (offsetTop > lowerBound)
        $(that.suggestionsContainer).scrollTop(
          offsetTop - that.options.maxHeight + heightDelta
        );
      that.el.val(that.getValue(that.suggestions[index].value));
    },
    onSelect: function (index) {
      var that = this,
        onSelectCallback = that.options.onSelect,
        suggestion = that.suggestions[index];
      that.el.val(that.getValue(suggestion.value));
      if ($.isFunction(onSelectCallback))
        onSelectCallback.call(that.element, suggestion);
    },
    getValue: function (value) {
      var that = this,
        delimiter = that.options.delimiter,
        currentValue,
        parts;
      if (!delimiter) return value;
      currentValue = that.currentValue;
      parts = currentValue.split(delimiter);
      if (parts.length === 1) return value;
      return (
        currentValue.substr(
          0,
          currentValue.length - parts[parts.length - 1].length
        ) + value
      );
    },
  };
  $.fn.autocomplete = function (options, args) {
    return this.each(function () {
      var dataKey = "autocomplete",
        inputElement = $(this),
        instance;
      if (typeof options === "string") {
        instance = inputElement.data(dataKey);
        if (typeof instance[options] === "function") instance[options](args);
      } else {
        instance = new Autocomplete(this, options);
        inputElement.data(dataKey, instance);
      }
    });
  };
});
!(function () {
  if (!Date.now)
    Date.now = function () {
      return +new Date();
    };
  try {
    document.createElement("div").style.setProperty("opacity", 0, "");
  } catch (error) {
    var d3_style_prototype = CSSStyleDeclaration.prototype,
      d3_style_setProperty = d3_style_prototype.setProperty;
    d3_style_prototype.setProperty = function (name, value, priority) {
      d3_style_setProperty.call(this, name, value + "", priority);
    };
  }
  d3 = { version: "2.9.6" };
  function d3_class(ctor, properties) {
    try {
      for (var key in properties)
        Object.defineProperty(ctor.prototype, key, {
          value: properties[key],
          enumerable: false,
        });
    } catch (e) {
      ctor.prototype = properties;
    }
  }
  var d3_array = d3_arraySlice;
  function d3_arrayCopy(pseudoarray) {
    var i = -1,
      n = pseudoarray.length,
      array = [];
    while (++i < n) array.push(pseudoarray[i]);
    return array;
  }
  function d3_arraySlice(pseudoarray) {
    return Array.prototype.slice.call(pseudoarray);
  }
  try {
    d3_array(document.documentElement.childNodes)[0].nodeType;
  } catch (e) {
    d3_array = d3_arrayCopy;
  }
  var d3_arraySubclass = [].__proto__
    ? function (array, prototype) {
        array.__proto__ = prototype;
      }
    : function (array, prototype) {
        for (var property in prototype) array[property] = prototype[property];
      };
  d3.map = function (object) {
    var map = new d3_Map();
    for (var key in object) map.set(key, object[key]);
    return map;
  };
  function d3_Map() {}
  d3_class(d3_Map, {
    has: function (key) {
      return d3_map_prefix + key in this;
    },
    get: function (key) {
      return this[d3_map_prefix + key];
    },
    set: function (key, value) {
      return (this[d3_map_prefix + key] = value);
    },
    remove: function (key) {
      key = d3_map_prefix + key;
      return key in this && delete this[key];
    },
    keys: function () {
      var keys = [];
      this.forEach(function (key) {
        keys.push(key);
      });
      return keys;
    },
    values: function () {
      var values = [];
      this.forEach(function (key, value) {
        values.push(value);
      });
      return values;
    },
    entries: function () {
      var entries = [];
      this.forEach(function (key, value) {
        entries.push({ key: key, value: value });
      });
      return entries;
    },
    forEach: function (f) {
      for (var key in this)
        if (key.charCodeAt(0) === d3_map_prefixCode)
          f.call(this, key.substring(1), this[key]);
    },
  });
  var d3_map_prefix = "\x00",
    d3_map_prefixCode = d3_map_prefix.charCodeAt(0);
  function d3_identity(d) {
    return d;
  }
  function d3_this() {
    return this;
  }
  function d3_true() {
    return true;
  }
  function d3_functor(v) {
    return typeof v === "function"
      ? v
      : function () {
          return v;
        };
  }
  d3.functor = d3_functor;
  d3.rebind = function (target, source) {
    var i = 1,
      n = arguments.length,
      method;
    while (++i < n)
      target[(method = arguments[i])] = d3_rebind(
        target,
        source,
        source[method]
      );
    return target;
  };
  function d3_rebind(target, source, method) {
    return function () {
      var value = method.apply(source, arguments);
      return arguments.length ? target : value;
    };
  }
  d3.ascending = function (a, b) {
    return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  };
  d3.descending = function (a, b) {
    return b < a ? -1 : b > a ? 1 : b >= a ? 0 : NaN;
  };
  d3.mean = function (array, f) {
    var n = array.length,
      a,
      m = 0,
      i = -1,
      j = 0;
    if (arguments.length === 1)
      while (++i < n) {
        if (d3_number((a = array[i]))) m += (a - m) / ++j;
      }
    else
      while (++i < n)
        if (d3_number((a = f.call(array, array[i], i)))) m += (a - m) / ++j;
    return j ? m : undefined;
  };
  d3.median = function (array, f) {
    if (arguments.length > 1) array = array.map(f);
    array = array.filter(d3_number);
    return array.length
      ? d3.quantile(array.sort(d3.ascending), 0.5)
      : undefined;
  };
  d3.min = function (array, f) {
    var i = -1,
      n = array.length,
      a,
      b;
    if (arguments.length === 1) {
      while (++i < n && ((a = array[i]) == null || a != a)) a = undefined;
      while (++i < n) if ((b = array[i]) != null && a > b) a = b;
    } else {
      while (++i < n && ((a = f.call(array, array[i], i)) == null || a != a))
        a = undefined;
      while (++i < n)
        if ((b = f.call(array, array[i], i)) != null && a > b) a = b;
    }
    return a;
  };
  d3.max = function (array, f) {
    var i = -1,
      n = array.length,
      a,
      b;
    if (arguments.length === 1) {
      while (++i < n && ((a = array[i]) == null || a != a)) a = undefined;
      while (++i < n) if ((b = array[i]) != null && b > a) a = b;
    } else {
      while (++i < n && ((a = f.call(array, array[i], i)) == null || a != a))
        a = undefined;
      while (++i < n)
        if ((b = f.call(array, array[i], i)) != null && b > a) a = b;
    }
    return a;
  };
  d3.extent = function (array, f) {
    var i = -1,
      n = array.length,
      a,
      b,
      c;
    if (arguments.length === 1) {
      while (++i < n && ((a = c = array[i]) == null || a != a))
        a = c = undefined;
      while (++i < n)
        if ((b = array[i]) != null) {
          if (a > b) a = b;
          if (c < b) c = b;
        }
    } else {
      while (
        ++i < n &&
        ((a = c = f.call(array, array[i], i)) == null || a != a)
      )
        a = undefined;
      while (++i < n)
        if ((b = f.call(array, array[i], i)) != null) {
          if (a > b) a = b;
          if (c < b) c = b;
        }
    }
    return [a, c];
  };
  d3.random = {
    normal: function (mean, deviation) {
      if (arguments.length < 2) deviation = 1;
      if (arguments.length < 1) mean = 0;
      return function () {
        var x, y, r;
        do {
          x = Math.random() * 2 - 1;
          y = Math.random() * 2 - 1;
          r = x * x + y * y;
        } while (!r || r > 1);
        return mean + deviation * x * Math.sqrt((-2 * Math.log(r)) / r);
      };
    },
  };
  function d3_number(x) {
    return x != null && !isNaN(x);
  }
  d3.sum = function (array, f) {
    var s = 0,
      n = array.length,
      a,
      i = -1;
    if (arguments.length === 1)
      while (++i < n) {
        if (!isNaN((a = +array[i]))) s += a;
      }
    else while (++i < n) if (!isNaN((a = +f.call(array, array[i], i)))) s += a;
    return s;
  };
  d3.quantile = function (values, p) {
    var H = (values.length - 1) * p + 1,
      h = Math.floor(H),
      v = values[h - 1],
      e = H - h;
    return e ? v + e * (values[h] - v) : v;
  };
  d3.transpose = function (matrix) {
    return d3.zip.apply(d3, matrix);
  };
  d3.zip = function () {
    if (!(n = arguments.length)) return [];
    for (
      var i = -1, m = d3.min(arguments, d3_zipLength), zips = new Array(m);
      ++i < m;

    )
      for (var j = -1, n, zip = (zips[i] = new Array(n)); ++j < n; )
        zip[j] = arguments[j][i];
    return zips;
  };
  function d3_zipLength(d) {
    return d.length;
  }
  d3.bisector = function (f) {
    return {
      left: function (a, x, lo, hi) {
        if (arguments.length < 3) lo = 0;
        if (arguments.length < 4) hi = a.length;
        while (lo < hi) {
          var mid = (lo + hi) >> 1;
          if (f.call(a, a[mid], mid) < x) lo = mid + 1;
          else hi = mid;
        }
        return lo;
      },
      right: function (a, x, lo, hi) {
        if (arguments.length < 3) lo = 0;
        if (arguments.length < 4) hi = a.length;
        while (lo < hi) {
          var mid = (lo + hi) >> 1;
          if (x < f.call(a, a[mid], mid)) hi = mid;
          else lo = mid + 1;
        }
        return lo;
      },
    };
  };
  var d3_bisector = d3.bisector(function (d) {
    return d;
  });
  d3.bisectLeft = d3_bisector.left;
  d3.bisect = d3.bisectRight = d3_bisector.right;
  d3.first = function (array, f) {
    var i = 0,
      n = array.length,
      a = array[0],
      b;
    if (arguments.length === 1) f = d3.ascending;
    while (++i < n) if (f.call(array, a, (b = array[i])) > 0) a = b;
    return a;
  };
  d3.last = function (array, f) {
    var i = 0,
      n = array.length,
      a = array[0],
      b;
    if (arguments.length === 1) f = d3.ascending;
    while (++i < n) if (f.call(array, a, (b = array[i])) <= 0) a = b;
    return a;
  };
  d3.nest = function () {
    var nest = {},
      keys = [],
      sortKeys = [],
      sortValues,
      rollup;
    function map(array, depth) {
      if (depth >= keys.length)
        return rollup
          ? rollup.call(nest, array)
          : sortValues
          ? array.sort(sortValues)
          : array;
      var i = -1,
        n = array.length,
        key = keys[depth++],
        keyValue,
        object,
        valuesByKey = new d3_Map(),
        values,
        o = {};
      while (++i < n)
        if ((values = valuesByKey.get((keyValue = key((object = array[i]))))))
          values.push(object);
        else valuesByKey.set(keyValue, [object]);
      valuesByKey.forEach(function (keyValue) {
        o[keyValue] = map(valuesByKey.get(keyValue), depth);
      });
      return o;
    }
    function entries(map, depth) {
      if (depth >= keys.length) return map;
      var a = [],
        sortKey = sortKeys[depth++],
        key;
      for (key in map) a.push({ key: key, values: entries(map[key], depth) });
      if (sortKey)
        a.sort(function (a, b) {
          return sortKey(a.key, b.key);
        });
      return a;
    }
    nest.map = function (array) {
      return map(array, 0);
    };
    nest.entries = function (array) {
      return entries(map(array, 0), 0);
    };
    nest.key = function (d) {
      keys.push(d);
      return nest;
    };
    nest.sortKeys = function (order) {
      sortKeys[keys.length - 1] = order;
      return nest;
    };
    nest.sortValues = function (order) {
      sortValues = order;
      return nest;
    };
    nest.rollup = function (f) {
      rollup = f;
      return nest;
    };
    return nest;
  };
  d3.keys = function (map) {
    var keys = [];
    for (var key in map) keys.push(key);
    return keys;
  };
  d3.values = function (map) {
    var values = [];
    for (var key in map) values.push(map[key]);
    return values;
  };
  d3.entries = function (map) {
    var entries = [];
    for (var key in map) entries.push({ key: key, value: map[key] });
    return entries;
  };
  d3.permute = function (array, indexes) {
    var permutes = [],
      i = -1,
      n = indexes.length;
    while (++i < n) permutes[i] = array[indexes[i]];
    return permutes;
  };
  d3.merge = function (arrays) {
    return Array.prototype.concat.apply([], arrays);
  };
  d3.split = function (array, f) {
    var arrays = [],
      values = [],
      value,
      i = -1,
      n = array.length;
    if (arguments.length < 2) f = d3_splitter;
    while (++i < n)
      if (f.call(values, (value = array[i]), i)) values = [];
      else {
        if (!values.length) arrays.push(values);
        values.push(value);
      }
    return arrays;
  };
  function d3_splitter(d) {
    return d == null;
  }
  function d3_collapse(s) {
    return s.replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
  }
  d3.range = function (start, stop, step) {
    if (arguments.length < 3) {
      step = 1;
      if (arguments.length < 2) {
        stop = start;
        start = 0;
      }
    }
    if ((stop - start) / step === Infinity) throw new Error("infinite range");
    var range = [],
      k = d3_range_integerScale(Math.abs(step)),
      i = -1,
      j;
    (start *= k), (stop *= k), (step *= k);
    if (step < 0) while ((j = start + step * ++i) > stop) range.push(j / k);
    else while ((j = start + step * ++i) < stop) range.push(j / k);
    return range;
  };
  function d3_range_integerScale(x) {
    var k = 1;
    while ((x * k) % 1) k *= 10;
    return k;
  }
  d3.requote = function (s) {
    return s.replace(d3_requote_re, "\\$&");
  };
  var d3_requote_re = /[\\\^\$\*\+\?\|\[\]\(\)\.\{\}]/g;
  d3.round = function (x, n) {
    return n ? Math.round(x * (n = Math.pow(10, n))) / n : Math.round(x);
  };
  d3.xhr = function (url, mime, callback) {
    var req = new XMLHttpRequest();
    if (arguments.length < 3) (callback = mime), (mime = null);
    else if (mime && req.overrideMimeType) req.overrideMimeType(mime);
    req.open("GET", url, true);
    if (mime) req.setRequestHeader("Accept", mime);
    req.onreadystatechange = function () {
      if (req.readyState === 4) {
        var s = req.status;
        callback(
          (!s && req.response) || (s >= 200 && s < 300) || s === 304
            ? req
            : null
        );
      }
    };
    req.send(null);
  };
  d3.text = function (url, mime, callback) {
    function ready(req) {
      callback(req && req.responseText);
    }
    if (arguments.length < 3) {
      callback = mime;
      mime = null;
    }
    d3.xhr(url, mime, ready);
  };
  d3.json = function (url, callback) {
    d3.text(url, "application/json", function (text) {
      callback(text ? JSON.parse(text) : null);
    });
  };
  d3.html = function (url, callback) {
    d3.text(url, "text/html", function (text) {
      if (text != null) {
        var range = document.createRange();
        range.selectNode(document.body);
        text = range.createContextualFragment(text);
      }
      callback(text);
    });
  };
  d3.xml = function (url, mime, callback) {
    function ready(req) {
      callback(req && req.responseXML);
    }
    if (arguments.length < 3) {
      callback = mime;
      mime = null;
    }
    d3.xhr(url, mime, ready);
  };
  var d3_nsPrefix = {
    svg: "http://www.w3.org/2000/svg",
    xhtml: "http://www.w3.org/1999/xhtml",
    xlink: "http://www.w3.org/1999/xlink",
    xml: "http://www.w3.org/XML/1998/namespace",
    xmlns: "http://www.w3.org/2000/xmlns/",
  };
  d3.ns = {
    prefix: d3_nsPrefix,
    qualify: function (name) {
      var i = name.indexOf(":"),
        prefix = name;
      if (i >= 0) {
        prefix = name.substring(0, i);
        name = name.substring(i + 1);
      }
      return d3_nsPrefix.hasOwnProperty(prefix)
        ? { space: d3_nsPrefix[prefix], local: name }
        : name;
    },
  };
  d3.dispatch = function () {
    var dispatch = new d3_dispatch(),
      i = -1,
      n = arguments.length;
    while (++i < n) dispatch[arguments[i]] = d3_dispatch_event(dispatch);
    return dispatch;
  };
  function d3_dispatch() {}
  d3_dispatch.prototype.on = function (type, listener) {
    var i = type.indexOf("."),
      name = "";
    if (i > 0) {
      name = type.substring(i + 1);
      type = type.substring(0, i);
    }
    return arguments.length < 2
      ? this[type].on(name)
      : this[type].on(name, listener);
  };
  function d3_dispatch_event(dispatch) {
    var listeners = [],
      listenerByName = new d3_Map();
    function event() {
      var z = listeners,
        i = -1,
        n = z.length,
        l;
      while (++i < n) if ((l = z[i].on)) l.apply(this, arguments);
      return dispatch;
    }
    event.on = function (name, listener) {
      var l = listenerByName.get(name),
        i;
      if (arguments.length < 2) return l && l.on;
      if (l) {
        l.on = null;
        listeners = listeners
          .slice(0, (i = listeners.indexOf(l)))
          .concat(listeners.slice(i + 1));
        listenerByName.remove(name);
      }
      if (listener) listeners.push(listenerByName.set(name, { on: listener }));
      return dispatch;
    };
    return event;
  }
  d3.format = function (specifier) {
    var match = d3_format_re.exec(specifier),
      fill = match[1] || " ",
      sign = match[3] || "",
      zfill = match[5],
      width = +match[6],
      comma = match[7],
      precision = match[8],
      type = match[9],
      scale = 1,
      suffix = "",
      integer = false;
    if (precision) precision = +precision.substring(1);
    if (zfill) {
      fill = "0";
      if (comma) width -= Math.floor((width - 1) / 4);
    }
    switch (type) {
      case "n":
        comma = true;
        type = "g";
        break;
      case "%":
        scale = 100;
        suffix = "%";
        type = "f";
        break;
      case "p":
        scale = 100;
        suffix = "%";
        type = "r";
        break;
      case "d":
        integer = true;
        precision = 0;
        break;
      case "s":
        scale = -1;
        type = "r";
        break;
    }
    if (type == "r" && !precision) type = "g";
    type = d3_format_types.get(type) || d3_format_typeDefault;
    return function (value) {
      if (integer && value % 1) return "";
      var negative = value < 0 && (value = -value) ? "???" : sign;
      if (scale < 0) {
        var prefix = d3.formatPrefix(value, precision);
        value = prefix.scale(value);
        suffix = prefix.symbol;
      } else value *= scale;
      value = type(value, precision);
      if (zfill) {
        var length = value.length + negative.length;
        if (length < width)
          value = new Array(width - length + 1).join(fill) + value;
        if (comma) value = d3_format_group(value);
        value = negative + value;
      } else {
        if (comma) value = d3_format_group(value);
        value = negative + value;
        var length = value.length;
        if (length < width)
          value = new Array(width - length + 1).join(fill) + value;
      }
      return value + suffix;
    };
  };
  var d3_format_re =
    /(?:([^{])?([<>=^]))?([+\- ])?(#)?(0)?([0-9]+)?(,)?(\.[0-9]+)?([a-zA-Z%])?/;
  var d3_format_types = d3.map({
    g: function (x, p) {
      return x.toPrecision(p);
    },
    e: function (x, p) {
      return x.toExponential(p);
    },
    f: function (x, p) {
      return x.toFixed(p);
    },
    r: function (x, p) {
      return d3
        .round(x, (p = d3_format_precision(x, p)))
        .toFixed(Math.max(0, Math.min(20, p)));
    },
  });
  function d3_format_precision(x, p) {
    return (
      p -
      (x
        ? 1 +
          Math.floor(
            Math.log(
              x + Math.pow(10, 1 + Math.floor(Math.log(x) / Math.LN10) - p)
            ) / Math.LN10
          )
        : 1)
    );
  }
  function d3_format_typeDefault(x) {
    return x + "";
  }
  function d3_format_group(value) {
    var i = value.lastIndexOf("."),
      f = i >= 0 ? value.substring(i) : ((i = value.length), ""),
      t = [];
    while (i > 0) t.push(value.substring((i -= 3), i + 3));
    return t.reverse().join(",") + f;
  }
  var d3_formatPrefixes = [
    "y",
    "z",
    "a",
    "f",
    "p",
    "n",
    "??",
    "m",
    "",
    "k",
    "M",
    "G",
    "T",
    "P",
    "E",
    "Z",
    "Y",
  ].map(d3_formatPrefix);
  d3.formatPrefix = function (value, precision) {
    var i = 0;
    if (value) {
      if (value < 0) value *= -1;
      if (precision)
        value = d3.round(value, d3_format_precision(value, precision));
      i = 1 + Math.floor(1e-12 + Math.log(value) / Math.LN10);
      i = Math.max(
        -24,
        Math.min(24, Math.floor((i <= 0 ? i + 1 : i - 1) / 3) * 3)
      );
    }
    return d3_formatPrefixes[8 + i / 3];
  };
  function d3_formatPrefix(d, i) {
    var k = Math.pow(10, Math.abs(8 - i) * 3);
    return {
      scale:
        i > 8
          ? function (d) {
              return d / k;
            }
          : function (d) {
              return d * k;
            },
      symbol: d,
    };
  }
  var d3_ease_quad = d3_ease_poly(2),
    d3_ease_cubic = d3_ease_poly(3),
    d3_ease_default = function () {
      return d3_ease_identity;
    };
  var d3_ease = d3.map({
    linear: d3_ease_default,
    poly: d3_ease_poly,
    quad: function () {
      return d3_ease_quad;
    },
    cubic: function () {
      return d3_ease_cubic;
    },
    sin: function () {
      return d3_ease_sin;
    },
    exp: function () {
      return d3_ease_exp;
    },
    circle: function () {
      return d3_ease_circle;
    },
    elastic: d3_ease_elastic,
    back: d3_ease_back,
    bounce: function () {
      return d3_ease_bounce;
    },
  });
  var d3_ease_mode = d3.map({
    in: d3_ease_identity,
    out: d3_ease_reverse,
    "in-out": d3_ease_reflect,
    "out-in": function (f) {
      return d3_ease_reflect(d3_ease_reverse(f));
    },
  });
  d3.ease = function (name) {
    var i = name.indexOf("-"),
      t = i >= 0 ? name.substring(0, i) : name,
      m = i >= 0 ? name.substring(i + 1) : "in";
    t = d3_ease.get(t) || d3_ease_default;
    m = d3_ease_mode.get(m) || d3_ease_identity;
    return d3_ease_clamp(
      m(t.apply(null, Array.prototype.slice.call(arguments, 1)))
    );
  };
  function d3_ease_clamp(f) {
    return function (t) {
      return t <= 0 ? 0 : t >= 1 ? 1 : f(t);
    };
  }
  function d3_ease_reverse(f) {
    return function (t) {
      return 1 - f(1 - t);
    };
  }
  function d3_ease_reflect(f) {
    return function (t) {
      return 0.5 * (t < 0.5 ? f(2 * t) : 2 - f(2 - 2 * t));
    };
  }
  function d3_ease_identity(t) {
    return t;
  }
  function d3_ease_poly(e) {
    return function (t) {
      return Math.pow(t, e);
    };
  }
  function d3_ease_sin(t) {
    return 1 - Math.cos((t * Math.PI) / 2);
  }
  function d3_ease_exp(t) {
    return Math.pow(2, 10 * (t - 1));
  }
  function d3_ease_circle(t) {
    return 1 - Math.sqrt(1 - t * t);
  }
  function d3_ease_elastic(a, p) {
    var s;
    if (arguments.length < 2) p = 0.45;
    if (arguments.length < 1) {
      a = 1;
      s = p / 4;
    } else s = (p / (2 * Math.PI)) * Math.asin(1 / a);
    return function (t) {
      return (
        1 + a * Math.pow(2, 10 * -t) * Math.sin(((t - s) * 2 * Math.PI) / p)
      );
    };
  }
  function d3_ease_back(s) {
    if (!s) s = 1.70158;
    return function (t) {
      return t * t * ((s + 1) * t - s);
    };
  }
  function d3_ease_bounce(t) {
    return t < 1 / 2.75
      ? 7.5625 * t * t
      : t < 2 / 2.75
      ? 7.5625 * (t -= 1.5 / 2.75) * t + 0.75
      : t < 2.5 / 2.75
      ? 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375
      : 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  }
  d3.event = null;
  function d3_eventCancel() {
    d3.event.stopPropagation();
    d3.event.preventDefault();
  }
  function d3_eventSource() {
    var e = d3.event,
      s;
    while ((s = e.sourceEvent)) e = s;
    return e;
  }
  function d3_eventDispatch(target) {
    var dispatch = new d3_dispatch(),
      i = 0,
      n = arguments.length;
    while (++i < n) dispatch[arguments[i]] = d3_dispatch_event(dispatch);
    dispatch.of = function (thiz, argumentz) {
      return function (e1) {
        try {
          var e0 = (e1.sourceEvent = d3.event);
          e1.target = target;
          d3.event = e1;
          dispatch[e1.type].apply(thiz, argumentz);
        } finally {
          d3.event = e0;
        }
      };
    };
    return dispatch;
  }
  d3.interpolate = function (a, b) {
    var i = d3.interpolators.length,
      f;
    while (--i >= 0 && !(f = d3.interpolators[i](a, b)));
    return f;
  };
  d3.interpolateNumber = function (a, b) {
    b -= a;
    return function (t) {
      return a + b * t;
    };
  };
  d3.interpolateRound = function (a, b) {
    b -= a;
    return function (t) {
      return Math.round(a + b * t);
    };
  };
  d3.interpolateString = function (a, b) {
    var m,
      i,
      j,
      s0 = 0,
      s1 = 0,
      s = [],
      q = [],
      n,
      o;
    d3_interpolate_number.lastIndex = 0;
    for (i = 0; (m = d3_interpolate_number.exec(b)); ++i) {
      if (m.index) s.push(b.substring(s0, (s1 = m.index)));
      q.push({ i: s.length, x: m[0] });
      s.push(null);
      s0 = d3_interpolate_number.lastIndex;
    }
    if (s0 < b.length) s.push(b.substring(s0));
    for (
      i = 0, n = q.length;
      (m = d3_interpolate_number.exec(a)) && i < n;
      ++i
    ) {
      o = q[i];
      if (o.x == m[0]) {
        if (o.i)
          if (s[o.i + 1] == null) {
            s[o.i - 1] += o.x;
            s.splice(o.i, 1);
            for (j = i + 1; j < n; ++j) q[j].i--;
          } else {
            s[o.i - 1] += o.x + s[o.i + 1];
            s.splice(o.i, 2);
            for (j = i + 1; j < n; ++j) q[j].i -= 2;
          }
        else if (s[o.i + 1] == null) s[o.i] = o.x;
        else {
          s[o.i] = o.x + s[o.i + 1];
          s.splice(o.i + 1, 1);
          for (j = i + 1; j < n; ++j) q[j].i--;
        }
        q.splice(i, 1);
        n--;
        i--;
      } else o.x = d3.interpolateNumber(parseFloat(m[0]), parseFloat(o.x));
    }
    while (i < n) {
      o = q.pop();
      if (s[o.i + 1] == null) s[o.i] = o.x;
      else {
        s[o.i] = o.x + s[o.i + 1];
        s.splice(o.i + 1, 1);
      }
      n--;
    }
    if (s.length === 1)
      return s[0] == null
        ? q[0].x
        : function () {
            return b;
          };
    return function (t) {
      for (i = 0; i < n; ++i) s[(o = q[i]).i] = o.x(t);
      return s.join("");
    };
  };
  d3.interpolateTransform = function (a, b) {
    var s = [],
      q = [],
      n,
      A = d3.transform(a),
      B = d3.transform(b),
      ta = A.translate,
      tb = B.translate,
      ra = A.rotate,
      rb = B.rotate,
      wa = A.skew,
      wb = B.skew,
      ka = A.scale,
      kb = B.scale;
    if (ta[0] != tb[0] || ta[1] != tb[1]) {
      s.push("translate(", null, ",", null, ")");
      q.push(
        { i: 1, x: d3.interpolateNumber(ta[0], tb[0]) },
        { i: 3, x: d3.interpolateNumber(ta[1], tb[1]) }
      );
    } else if (tb[0] || tb[1]) s.push("translate(" + tb + ")");
    else s.push("");
    if (ra != rb) {
      if (ra - rb > 180) rb += 360;
      else if (rb - ra > 180) ra += 360;
      q.push({
        i: s.push(s.pop() + "rotate(", null, ")") - 2,
        x: d3.interpolateNumber(ra, rb),
      });
    } else if (rb) s.push(s.pop() + "rotate(" + rb + ")");
    if (wa != wb)
      q.push({
        i: s.push(s.pop() + "skewX(", null, ")") - 2,
        x: d3.interpolateNumber(wa, wb),
      });
    else if (wb) s.push(s.pop() + "skewX(" + wb + ")");
    if (ka[0] != kb[0] || ka[1] != kb[1]) {
      n = s.push(s.pop() + "scale(", null, ",", null, ")");
      q.push(
        { i: n - 4, x: d3.interpolateNumber(ka[0], kb[0]) },
        { i: n - 2, x: d3.interpolateNumber(ka[1], kb[1]) }
      );
    } else if (kb[0] != 1 || kb[1] != 1) s.push(s.pop() + "scale(" + kb + ")");
    n = q.length;
    return function (t) {
      var i = -1,
        o;
      while (++i < n) s[(o = q[i]).i] = o.x(t);
      return s.join("");
    };
  };
  d3.interpolateRgb = function (a, b) {
    a = d3.rgb(a);
    b = d3.rgb(b);
    var ar = a.r,
      ag = a.g,
      ab = a.b,
      br = b.r - ar,
      bg = b.g - ag,
      bb = b.b - ab;
    return function (t) {
      return (
        "#" +
        d3_rgb_hex(Math.round(ar + br * t)) +
        d3_rgb_hex(Math.round(ag + bg * t)) +
        d3_rgb_hex(Math.round(ab + bb * t))
      );
    };
  };
  d3.interpolateHsl = function (a, b) {
    a = d3.hsl(a);
    b = d3.hsl(b);
    var h0 = a.h,
      s0 = a.s,
      l0 = a.l,
      h1 = b.h - h0,
      s1 = b.s - s0,
      l1 = b.l - l0;
    if (h1 > 180) h1 -= 360;
    else if (h1 < -180) h1 += 360;
    return function (t) {
      return d3_hsl_rgb(h0 + h1 * t, s0 + s1 * t, l0 + l1 * t).toString();
    };
  };
  d3.interpolateArray = function (a, b) {
    var x = [],
      c = [],
      na = a.length,
      nb = b.length,
      n0 = Math.min(a.length, b.length),
      i;
    for (i = 0; i < n0; ++i) x.push(d3.interpolate(a[i], b[i]));
    for (; i < na; ++i) c[i] = a[i];
    for (; i < nb; ++i) c[i] = b[i];
    return function (t) {
      for (i = 0; i < n0; ++i) c[i] = x[i](t);
      return c;
    };
  };
  d3.interpolateObject = function (a, b) {
    var i = {},
      c = {},
      k;
    for (k in a)
      if (k in b) i[k] = d3_interpolateByName(k)(a[k], b[k]);
      else c[k] = a[k];
    for (k in b) if (!(k in a)) c[k] = b[k];
    return function (t) {
      for (k in i) c[k] = i[k](t);
      return c;
    };
  };
  var d3_interpolate_number = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g;
  function d3_interpolateByName(n) {
    return n == "transform" ? d3.interpolateTransform : d3.interpolate;
  }
  d3.interpolators = [
    d3.interpolateObject,
    function (a, b) {
      return b instanceof Array && d3.interpolateArray(a, b);
    },
    function (a, b) {
      return (
        (typeof a === "string" || typeof b === "string") &&
        d3.interpolateString(a + "", b + "")
      );
    },
    function (a, b) {
      return (
        (typeof b === "string"
          ? d3_rgb_names.has(b) || /^(#|rgb\(|hsl\()/.test(b)
          : b instanceof d3_Rgb || b instanceof d3_Hsl) &&
        d3.interpolateRgb(a, b)
      );
    },
    function (a, b) {
      return !isNaN((a = +a)) && !isNaN((b = +b)) && d3.interpolateNumber(a, b);
    },
  ];
  function d3_uninterpolateNumber(a, b) {
    b = b - (a = +a) ? 1 / (b - a) : 0;
    return function (x) {
      return (x - a) * b;
    };
  }
  function d3_uninterpolateClamp(a, b) {
    b = b - (a = +a) ? 1 / (b - a) : 0;
    return function (x) {
      return Math.max(0, Math.min(1, (x - a) * b));
    };
  }
  d3.rgb = function (r, g, b) {
    return arguments.length === 1
      ? r instanceof d3_Rgb
        ? d3_rgb(r.r, r.g, r.b)
        : d3_rgb_parse("" + r, d3_rgb, d3_hsl_rgb)
      : d3_rgb(~~r, ~~g, ~~b);
  };
  function d3_rgb(r, g, b) {
    return new d3_Rgb(r, g, b);
  }
  function d3_Rgb(r, g, b) {
    this.r = r;
    this.g = g;
    this.b = b;
  }
  d3_Rgb.prototype.brighter = function (k) {
    k = Math.pow(0.7, arguments.length ? k : 1);
    var r = this.r,
      g = this.g,
      b = this.b,
      i = 30;
    if (!r && !g && !b) return d3_rgb(i, i, i);
    if (r && r < i) r = i;
    if (g && g < i) g = i;
    if (b && b < i) b = i;
    return d3_rgb(
      Math.min(255, Math.floor(r / k)),
      Math.min(255, Math.floor(g / k)),
      Math.min(255, Math.floor(b / k))
    );
  };
  d3_Rgb.prototype.darker = function (k) {
    k = Math.pow(0.7, arguments.length ? k : 1);
    return d3_rgb(
      Math.floor(k * this.r),
      Math.floor(k * this.g),
      Math.floor(k * this.b)
    );
  };
  d3_Rgb.prototype.hsl = function () {
    return d3_rgb_hsl(this.r, this.g, this.b);
  };
  d3_Rgb.prototype.toString = function () {
    return "#" + d3_rgb_hex(this.r) + d3_rgb_hex(this.g) + d3_rgb_hex(this.b);
  };
  function d3_rgb_hex(v) {
    return v < 16
      ? "0" + Math.max(0, v).toString(16)
      : Math.min(255, v).toString(16);
  }
  function d3_rgb_parse(format, rgb, hsl) {
    var r = 0,
      g = 0,
      b = 0,
      m1,
      m2,
      name;
    m1 = /([a-z]+)\((.*)\)/i.exec(format);
    if (m1) {
      m2 = m1[2].split(",");
      switch (m1[1]) {
        case "hsl":
          return hsl(
            parseFloat(m2[0]),
            parseFloat(m2[1]) / 100,
            parseFloat(m2[2]) / 100
          );
        case "rgb":
          return rgb(
            d3_rgb_parseNumber(m2[0]),
            d3_rgb_parseNumber(m2[1]),
            d3_rgb_parseNumber(m2[2])
          );
      }
    }
    if ((name = d3_rgb_names.get(format))) return rgb(name.r, name.g, name.b);
    if (format != null && format.charAt(0) === "#") {
      if (format.length === 4) {
        r = format.charAt(1);
        r += r;
        g = format.charAt(2);
        g += g;
        b = format.charAt(3);
        b += b;
      } else if (format.length === 7) {
        r = format.substring(1, 3);
        g = format.substring(3, 5);
        b = format.substring(5, 7);
      }
      r = parseInt(r, 16);
      g = parseInt(g, 16);
      b = parseInt(b, 16);
    }
    return rgb(r, g, b);
  }
  function d3_rgb_hsl(r, g, b) {
    var min = Math.min((r /= 255), (g /= 255), (b /= 255)),
      max = Math.max(r, g, b),
      d = max - min,
      h,
      s,
      l = (max + min) / 2;
    if (d) {
      s = l < 0.5 ? d / (max + min) : d / (2 - max - min);
      if (r == max) h = (g - b) / d + (g < b ? 6 : 0);
      else if (g == max) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    } else s = h = 0;
    return d3_hsl(h, s, l);
  }
  function d3_rgb_parseNumber(c) {
    var f = parseFloat(c);
    return c.charAt(c.length - 1) === "%" ? Math.round(f * 2.55) : f;
  }
  var d3_rgb_names = d3.map({
    aliceblue: "#f0f8ff",
    antiquewhite: "#faebd7",
    aqua: "#00ffff",
    aquamarine: "#7fffd4",
    azure: "#f0ffff",
    beige: "#f5f5dc",
    bisque: "#ffe4c4",
    black: "#000000",
    blanchedalmond: "#ffebcd",
    blue: "#0000ff",
    blueviolet: "#8a2be2",
    brown: "#a52a2a",
    burlywood: "#deb887",
    cadetblue: "#5f9ea0",
    chartreuse: "#7fff00",
    chocolate: "#d2691e",
    coral: "#ff7f50",
    cornflowerblue: "#6495ed",
    cornsilk: "#fff8dc",
    crimson: "#dc143c",
    cyan: "#00ffff",
    darkblue: "#00008b",
    darkcyan: "#008b8b",
    darkgoldenrod: "#b8860b",
    darkgray: "#a9a9a9",
    darkgreen: "#006400",
    darkgrey: "#a9a9a9",
    darkkhaki: "#bdb76b",
    darkmagenta: "#8b008b",
    darkolivegreen: "#556b2f",
    darkorange: "#ff8c00",
    darkorchid: "#9932cc",
    darkred: "#8b0000",
    darksalmon: "#e9967a",
    darkseagreen: "#8fbc8f",
    darkslateblue: "#483d8b",
    darkslategray: "#2f4f4f",
    darkslategrey: "#2f4f4f",
    darkturquoise: "#00ced1",
    darkviolet: "#9400d3",
    deeppink: "#ff1493",
    deepskyblue: "#00bfff",
    dimgray: "#696969",
    dimgrey: "#696969",
    dodgerblue: "#1e90ff",
    firebrick: "#b22222",
    floralwhite: "#fffaf0",
    forestgreen: "#228b22",
    fuchsia: "#ff00ff",
    gainsboro: "#dcdcdc",
    ghostwhite: "#f8f8ff",
    gold: "#ffd700",
    goldenrod: "#daa520",
    gray: "#808080",
    green: "#008000",
    greenyellow: "#adff2f",
    grey: "#808080",
    honeydew: "#f0fff0",
    hotpink: "#ff69b4",
    indianred: "#cd5c5c",
    indigo: "#4b0082",
    ivory: "#fffff0",
    khaki: "#f0e68c",
    lavender: "#e6e6fa",
    lavenderblush: "#fff0f5",
    lawngreen: "#7cfc00",
    lemonchiffon: "#fffacd",
    lightblue: "#add8e6",
    lightcoral: "#f08080",
    lightcyan: "#e0ffff",
    lightgoldenrodyellow: "#fafad2",
    lightgray: "#d3d3d3",
    lightgreen: "#90ee90",
    lightgrey: "#d3d3d3",
    lightpink: "#ffb6c1",
    lightsalmon: "#ffa07a",
    lightseagreen: "#20b2aa",
    lightskyblue: "#87cefa",
    lightslategray: "#778899",
    lightslategrey: "#778899",
    lightsteelblue: "#b0c4de",
    lightyellow: "#ffffe0",
    lime: "#00ff00",
    limegreen: "#32cd32",
    linen: "#faf0e6",
    magenta: "#ff00ff",
    maroon: "#800000",
    mediumaquamarine: "#66cdaa",
    mediumblue: "#0000cd",
    mediumorchid: "#ba55d3",
    mediumpurple: "#9370db",
    mediumseagreen: "#3cb371",
    mediumslateblue: "#7b68ee",
    mediumspringgreen: "#00fa9a",
    mediumturquoise: "#48d1cc",
    mediumvioletred: "#c71585",
    midnightblue: "#191970",
    mintcream: "#f5fffa",
    mistyrose: "#ffe4e1",
    moccasin: "#ffe4b5",
    navajowhite: "#ffdead",
    navy: "#000080",
    oldlace: "#fdf5e6",
    olive: "#808000",
    olivedrab: "#6b8e23",
    orange: "#ffa500",
    orangered: "#ff4500",
    orchid: "#da70d6",
    palegoldenrod: "#eee8aa",
    palegreen: "#98fb98",
    paleturquoise: "#afeeee",
    palevioletred: "#db7093",
    papayawhip: "#ffefd5",
    peachpuff: "#ffdab9",
    peru: "#cd853f",
    pink: "#ffc0cb",
    plum: "#dda0dd",
    powderblue: "#b0e0e6",
    purple: "#800080",
    red: "#ff0000",
    rosybrown: "#bc8f8f",
    royalblue: "#4169e1",
    saddlebrown: "#8b4513",
    salmon: "#fa8072",
    sandybrown: "#f4a460",
    seagreen: "#2e8b57",
    seashell: "#fff5ee",
    sienna: "#a0522d",
    silver: "#c0c0c0",
    skyblue: "#87ceeb",
    slateblue: "#6a5acd",
    slategray: "#708090",
    slategrey: "#708090",
    snow: "#fffafa",
    springgreen: "#00ff7f",
    steelblue: "#4682b4",
    tan: "#d2b48c",
    teal: "#008080",
    thistle: "#d8bfd8",
    tomato: "#ff6347",
    turquoise: "#40e0d0",
    violet: "#ee82ee",
    wheat: "#f5deb3",
    white: "#ffffff",
    whitesmoke: "#f5f5f5",
    yellow: "#ffff00",
    yellowgreen: "#9acd32",
  });
  d3_rgb_names.forEach(function (key, value) {
    d3_rgb_names.set(key, d3_rgb_parse(value, d3_rgb, d3_hsl_rgb));
  });
  d3.hsl = function (h, s, l) {
    return arguments.length === 1
      ? h instanceof d3_Hsl
        ? d3_hsl(h.h, h.s, h.l)
        : d3_rgb_parse("" + h, d3_rgb_hsl, d3_hsl)
      : d3_hsl(+h, +s, +l);
  };
  function d3_hsl(h, s, l) {
    return new d3_Hsl(h, s, l);
  }
  function d3_Hsl(h, s, l) {
    this.h = h;
    this.s = s;
    this.l = l;
  }
  d3_Hsl.prototype.brighter = function (k) {
    k = Math.pow(0.7, arguments.length ? k : 1);
    return d3_hsl(this.h, this.s, this.l / k);
  };
  d3_Hsl.prototype.darker = function (k) {
    k = Math.pow(0.7, arguments.length ? k : 1);
    return d3_hsl(this.h, this.s, k * this.l);
  };
  d3_Hsl.prototype.rgb = function () {
    return d3_hsl_rgb(this.h, this.s, this.l);
  };
  d3_Hsl.prototype.toString = function () {
    return this.rgb().toString();
  };
  function d3_hsl_rgb(h, s, l) {
    var m1, m2;
    h = h % 360;
    if (h < 0) h += 360;
    s = s < 0 ? 0 : s > 1 ? 1 : s;
    l = l < 0 ? 0 : l > 1 ? 1 : l;
    m2 = l <= 0.5 ? l * (1 + s) : l + s - l * s;
    m1 = 2 * l - m2;
    function v(h) {
      if (h > 360) h -= 360;
      else if (h < 0) h += 360;
      if (h < 60) return m1 + ((m2 - m1) * h) / 60;
      if (h < 180) return m2;
      if (h < 240) return m1 + ((m2 - m1) * (240 - h)) / 60;
      return m1;
    }
    function vv(h) {
      return Math.round(v(h) * 255);
    }
    return d3_rgb(vv(h + 120), vv(h), vv(h - 120));
  }
  function d3_selection(groups) {
    d3_arraySubclass(groups, d3_selectionPrototype);
    return groups;
  }
  var d3_select = function (s, n) {
      return n.querySelector(s);
    },
    d3_selectAll = function (s, n) {
      return n.querySelectorAll(s);
    },
    d3_selectRoot = document.documentElement,
    d3_selectMatcher =
      d3_selectRoot.matchesSelector ||
      d3_selectRoot.webkitMatchesSelector ||
      d3_selectRoot.mozMatchesSelector ||
      d3_selectRoot.msMatchesSelector ||
      d3_selectRoot.oMatchesSelector,
    d3_selectMatches = function (n, s) {
      return d3_selectMatcher.call(n, s);
    };
  if (typeof Sizzle === "function") {
    d3_select = function (s, n) {
      return Sizzle(s, n)[0] || null;
    };
    d3_selectAll = function (s, n) {
      return Sizzle.uniqueSort(Sizzle(s, n));
    };
    d3_selectMatches = Sizzle.matchesSelector;
  }
  var d3_selectionPrototype = [];
  d3.selection = function () {
    return d3_selectionRoot;
  };
  d3.selection.prototype = d3_selectionPrototype;
  d3_selectionPrototype.select = function (selector) {
    var subgroups = [],
      subgroup,
      subnode,
      group,
      node;
    if (typeof selector !== "function")
      selector = d3_selection_selector(selector);
    for (var j = -1, m = this.length; ++j < m; ) {
      subgroups.push((subgroup = []));
      subgroup.parentNode = (group = this[j]).parentNode;
      for (var i = -1, n = group.length; ++i < n; )
        if ((node = group[i])) {
          subgroup.push((subnode = selector.call(node, node.__data__, i)));
          if (subnode && "__data__" in node) subnode.__data__ = node.__data__;
        } else subgroup.push(null);
    }
    return d3_selection(subgroups);
  };
  function d3_selection_selector(selector) {
    return function () {
      return d3_select(selector, this);
    };
  }
  d3_selectionPrototype.selectAll = function (selector) {
    var subgroups = [],
      subgroup,
      node;
    if (typeof selector !== "function")
      selector = d3_selection_selectorAll(selector);
    for (var j = -1, m = this.length; ++j < m; )
      for (var group = this[j], i = -1, n = group.length; ++i < n; )
        if ((node = group[i])) {
          subgroups.push(
            (subgroup = d3_array(selector.call(node, node.__data__, i)))
          );
          subgroup.parentNode = node;
        }
    return d3_selection(subgroups);
  };
  function d3_selection_selectorAll(selector) {
    return function () {
      return d3_selectAll(selector, this);
    };
  }
  d3_selectionPrototype.attr = function (name, value) {
    name = d3.ns.qualify(name);
    if (arguments.length < 2) {
      var node = this.node();
      return name.local
        ? node.getAttributeNS(name.space, name.local)
        : node.getAttribute(name);
    }
    function attrNull() {
      this.removeAttribute(name);
    }
    function attrNullNS() {
      this.removeAttributeNS(name.space, name.local);
    }
    function attrConstant() {
      this.setAttribute(name, value);
    }
    function attrConstantNS() {
      this.setAttributeNS(name.space, name.local, value);
    }
    function attrFunction() {
      var x = value.apply(this, arguments);
      if (x == null) this.removeAttribute(name);
      else this.setAttribute(name, x);
    }
    function attrFunctionNS() {
      var x = value.apply(this, arguments);
      if (x == null) this.removeAttributeNS(name.space, name.local);
      else this.setAttributeNS(name.space, name.local, x);
    }
    return this.each(
      value == null
        ? name.local
          ? attrNullNS
          : attrNull
        : typeof value === "function"
        ? name.local
          ? attrFunctionNS
          : attrFunction
        : name.local
        ? attrConstantNS
        : attrConstant
    );
  };
  d3_selectionPrototype.classed = function (name, value) {
    var names = d3_collapse(name).split(" "),
      n = names.length,
      i = -1;
    if (arguments.length > 1) {
      while (++i < n) d3_selection_classed.call(this, names[i], value);
      return this;
    } else {
      while (++i < n)
        if (!d3_selection_classed.call(this, names[i])) return false;
      return true;
    }
  };
  function d3_selection_classed(name, value) {
    var re = new RegExp("(^|\\s+)" + d3.requote(name) + "(\\s+|$)", "g");
    if (arguments.length < 2) {
      var node = this.node();
      if ((c = node.classList)) return c.contains(name);
      var c = node.className;
      re.lastIndex = 0;
      return re.test(c.baseVal != null ? c.baseVal : c);
    }
    function classedAdd() {
      if ((c = this.classList)) return c.add(name);
      var c = this.className,
        cb = c.baseVal != null,
        cv = cb ? c.baseVal : c;
      re.lastIndex = 0;
      if (!re.test(cv)) {
        cv = d3_collapse(cv + " " + name);
        if (cb) c.baseVal = cv;
        else this.className = cv;
      }
    }
    function classedRemove() {
      if ((c = this.classList)) return c.remove(name);
      var c = this.className,
        cb = c.baseVal != null,
        cv = cb ? c.baseVal : c;
      cv = d3_collapse(cv.replace(re, " "));
      if (cb) c.baseVal = cv;
      else this.className = cv;
    }
    function classedFunction() {
      (value.apply(this, arguments) ? classedAdd : classedRemove).call(this);
    }
    return this.each(
      typeof value === "function"
        ? classedFunction
        : value
        ? classedAdd
        : classedRemove
    );
  }
  d3_selectionPrototype.style = function (name, value, priority) {
    if (arguments.length < 3) priority = "";
    if (arguments.length < 2)
      return window.getComputedStyle(this.node(), null).getPropertyValue(name);
    function styleNull() {
      this.style.removeProperty(name);
    }
    function styleConstant() {
      this.style.setProperty(name, value, priority);
    }
    function styleFunction() {
      var x = value.apply(this, arguments);
      if (x == null) this.style.removeProperty(name);
      else this.style.setProperty(name, x, priority);
    }
    return this.each(
      value == null
        ? styleNull
        : typeof value === "function"
        ? styleFunction
        : styleConstant
    );
  };
  d3_selectionPrototype.property = function (name, value) {
    if (arguments.length < 2) return this.node()[name];
    function propertyNull() {
      delete this[name];
    }
    function propertyConstant() {
      this[name] = value;
    }
    function propertyFunction() {
      var x = value.apply(this, arguments);
      if (x == null) delete this[name];
      else this[name] = x;
    }
    return this.each(
      value == null
        ? propertyNull
        : typeof value === "function"
        ? propertyFunction
        : propertyConstant
    );
  };
  d3_selectionPrototype.text = function (value) {
    return arguments.length < 1
      ? this.node().textContent
      : this.each(
          typeof value === "function"
            ? function () {
                var v = value.apply(this, arguments);
                this.textContent = v == null ? "" : v;
              }
            : value == null
            ? function () {
                this.textContent = "";
              }
            : function () {
                this.textContent = value;
              }
        );
  };
  d3_selectionPrototype.html = function (value) {
    return arguments.length < 1
      ? this.node().innerHTML
      : this.each(
          typeof value === "function"
            ? function () {
                var v = value.apply(this, arguments);
                this.innerHTML = v == null ? "" : v;
              }
            : value == null
            ? function () {
                this.innerHTML = "";
              }
            : function () {
                this.innerHTML = value;
              }
        );
  };
  d3_selectionPrototype.append = function (name) {
    name = d3.ns.qualify(name);
    function append() {
      return this.appendChild(
        document.createElementNS(this.namespaceURI, name)
      );
    }
    function appendNS() {
      return this.appendChild(document.createElementNS(name.space, name.local));
    }
    return this.select(name.local ? appendNS : append);
  };
  d3_selectionPrototype.insert = function (name, before) {
    name = d3.ns.qualify(name);
    function insert() {
      return this.insertBefore(
        document.createElementNS(this.namespaceURI, name),
        d3_select(before, this)
      );
    }
    function insertNS() {
      return this.insertBefore(
        document.createElementNS(name.space, name.local),
        d3_select(before, this)
      );
    }
    return this.select(name.local ? insertNS : insert);
  };
  d3_selectionPrototype.remove = function () {
    return this.each(function () {
      var parent = this.parentNode;
      if (parent) parent.removeChild(this);
    });
  };
  d3_selectionPrototype.data = function (value, key) {
    var i = -1,
      n = this.length,
      group,
      node;
    if (!arguments.length) {
      value = new Array((n = (group = this[0]).length));
      while (++i < n) if ((node = group[i])) value[i] = node.__data__;
      return value;
    }
    function bind(group, groupData) {
      var i,
        n = group.length,
        m = groupData.length,
        n0 = Math.min(n, m),
        n1 = Math.max(n, m),
        updateNodes = [],
        enterNodes = [],
        exitNodes = [],
        node,
        nodeData;
      if (key) {
        var nodeByKeyValue = new d3_Map(),
          keyValues = [],
          keyValue,
          j = groupData.length;
        for (i = -1; ++i < n; ) {
          keyValue = key.call((node = group[i]), node.__data__, i);
          if (nodeByKeyValue.has(keyValue)) exitNodes[j++] = node;
          else nodeByKeyValue.set(keyValue, node);
          keyValues.push(keyValue);
        }
        for (i = -1; ++i < m; ) {
          keyValue = key.call(groupData, (nodeData = groupData[i]), i);
          if (nodeByKeyValue.has(keyValue)) {
            updateNodes[i] = node = nodeByKeyValue.get(keyValue);
            node.__data__ = nodeData;
            enterNodes[i] = exitNodes[i] = null;
          } else {
            enterNodes[i] = d3_selection_dataNode(nodeData);
            updateNodes[i] = exitNodes[i] = null;
          }
          nodeByKeyValue.remove(keyValue);
        }
        for (i = -1; ++i < n; )
          if (nodeByKeyValue.has(keyValues[i])) exitNodes[i] = group[i];
      } else {
        for (i = -1; ++i < n0; ) {
          node = group[i];
          nodeData = groupData[i];
          if (node) {
            node.__data__ = nodeData;
            updateNodes[i] = node;
            enterNodes[i] = exitNodes[i] = null;
          } else {
            enterNodes[i] = d3_selection_dataNode(nodeData);
            updateNodes[i] = exitNodes[i] = null;
          }
        }
        for (; i < m; ++i) {
          enterNodes[i] = d3_selection_dataNode(groupData[i]);
          updateNodes[i] = exitNodes[i] = null;
        }
        for (; i < n1; ++i) {
          exitNodes[i] = group[i];
          enterNodes[i] = updateNodes[i] = null;
        }
      }
      enterNodes.update = updateNodes;
      enterNodes.parentNode =
        updateNodes.parentNode =
        exitNodes.parentNode =
          group.parentNode;
      enter.push(enterNodes);
      update.push(updateNodes);
      exit.push(exitNodes);
    }
    var enter = d3_selection_enter([]),
      update = d3_selection([]),
      exit = d3_selection([]);
    if (typeof value === "function")
      while (++i < n)
        bind(
          (group = this[i]),
          value.call(group, group.parentNode.__data__, i)
        );
    else while (++i < n) bind((group = this[i]), value);
    update.enter = function () {
      return enter;
    };
    update.exit = function () {
      return exit;
    };
    return update;
  };
  function d3_selection_dataNode(data) {
    return { __data__: data };
  }
  d3_selectionPrototype.datum = d3_selectionPrototype.map = function (value) {
    return arguments.length < 1
      ? this.property("__data__")
      : this.property("__data__", value);
  };
  d3_selectionPrototype.filter = function (filter) {
    var subgroups = [],
      subgroup,
      group,
      node;
    if (typeof filter !== "function") filter = d3_selection_filter(filter);
    for (var j = 0, m = this.length; j < m; j++) {
      subgroups.push((subgroup = []));
      subgroup.parentNode = (group = this[j]).parentNode;
      for (var i = 0, n = group.length; i < n; i++)
        if ((node = group[i]) && filter.call(node, node.__data__, i))
          subgroup.push(node);
    }
    return d3_selection(subgroups);
  };
  function d3_selection_filter(selector) {
    return function () {
      return d3_selectMatches(this, selector);
    };
  }
  d3_selectionPrototype.order = function () {
    for (var j = -1, m = this.length; ++j < m; )
      for (
        var group = this[j], i = group.length - 1, next = group[i], node;
        --i >= 0;

      )
        if ((node = group[i])) {
          if (next && next !== node.nextSibling)
            next.parentNode.insertBefore(node, next);
          next = node;
        }
    return this;
  };
  d3_selectionPrototype.sort = function (comparator) {
    comparator = d3_selection_sortComparator.apply(this, arguments);
    for (var j = -1, m = this.length; ++j < m; ) this[j].sort(comparator);
    return this.order();
  };
  function d3_selection_sortComparator(comparator) {
    if (!arguments.length) comparator = d3.ascending;
    return function (a, b) {
      return comparator(a && a.__data__, b && b.__data__);
    };
  }
  d3_selectionPrototype.on = function (type, listener, capture) {
    if (arguments.length < 3) capture = false;
    var name = "__on" + type,
      i = type.indexOf(".");
    if (i > 0) type = type.substring(0, i);
    if (arguments.length < 2) return (i = this.node()[name]) && i._;
    return this.each(function (d, i) {
      var node = this,
        o = node[name];
      if (o) {
        node.removeEventListener(type, o, o.$);
        delete node[name];
      }
      if (listener) {
        node.addEventListener(type, (node[name] = l), (l.$ = capture));
        l._ = listener;
      }
      function l(e) {
        var o = d3.event;
        d3.event = e;
        try {
          listener.call(node, node.__data__, i);
        } finally {
          d3.event = o;
        }
      }
    });
  };
  d3_selectionPrototype.each = function (callback) {
    return d3_selection_each(this, function (node, i, j) {
      callback.call(node, node.__data__, i, j);
    });
  };
  function d3_selection_each(groups, callback) {
    for (var j = 0, m = groups.length; j < m; j++)
      for (var group = groups[j], i = 0, n = group.length, node; i < n; i++)
        if ((node = group[i])) callback(node, i, j);
    return groups;
  }
  d3_selectionPrototype.call = function (callback) {
    callback.apply(this, ((arguments[0] = this), arguments));
    return this;
  };
  d3_selectionPrototype.empty = function () {
    return !this.node();
  };
  d3_selectionPrototype.node = function (callback) {
    for (var j = 0, m = this.length; j < m; j++)
      for (var group = this[j], i = 0, n = group.length; i < n; i++) {
        var node = group[i];
        if (node) return node;
      }
    return null;
  };
  d3_selectionPrototype.transition = function () {
    var subgroups = [],
      subgroup,
      node;
    for (var j = -1, m = this.length; ++j < m; ) {
      subgroups.push((subgroup = []));
      for (var group = this[j], i = -1, n = group.length; ++i < n; )
        subgroup.push(
          (node = group[i])
            ? {
                node: node,
                delay: d3_transitionDelay,
                duration: d3_transitionDuration,
              }
            : null
        );
    }
    return d3_transition(
      subgroups,
      d3_transitionId || ++d3_transitionNextId,
      Date.now()
    );
  };
  var d3_selectionRoot = d3_selection([[document]]);
  d3_selectionRoot[0].parentNode = d3_selectRoot;
  d3.select = function (selector) {
    return typeof selector === "string"
      ? d3_selectionRoot.select(selector)
      : d3_selection([[selector]]);
  };
  d3.selectAll = function (selector) {
    return typeof selector === "string"
      ? d3_selectionRoot.selectAll(selector)
      : d3_selection([d3_array(selector)]);
  };
  function d3_selection_enter(selection) {
    d3_arraySubclass(selection, d3_selection_enterPrototype);
    return selection;
  }
  var d3_selection_enterPrototype = [];
  d3.selection.enter = d3_selection_enter;
  d3.selection.enter.prototype = d3_selection_enterPrototype;
  d3_selection_enterPrototype.append = d3_selectionPrototype.append;
  d3_selection_enterPrototype.insert = d3_selectionPrototype.insert;
  d3_selection_enterPrototype.empty = d3_selectionPrototype.empty;
  d3_selection_enterPrototype.node = d3_selectionPrototype.node;
  d3_selection_enterPrototype.select = function (selector) {
    var subgroups = [],
      subgroup,
      subnode,
      upgroup,
      group,
      node;
    for (var j = -1, m = this.length; ++j < m; ) {
      upgroup = (group = this[j]).update;
      subgroups.push((subgroup = []));
      subgroup.parentNode = group.parentNode;
      for (var i = -1, n = group.length; ++i < n; )
        if ((node = group[i])) {
          subgroup.push(
            (upgroup[i] = subnode =
              selector.call(group.parentNode, node.__data__, i))
          );
          subnode.__data__ = node.__data__;
        } else subgroup.push(null);
    }
    return d3_selection(subgroups);
  };
  function d3_transition(groups, id, time) {
    d3_arraySubclass(groups, d3_transitionPrototype);
    var tweens = new d3_Map(),
      event = d3.dispatch("start", "end"),
      ease = d3_transitionEase;
    groups.id = id;
    groups.time = time;
    groups.tween = function (name, tween) {
      if (arguments.length < 2) return tweens.get(name);
      if (tween == null) tweens.remove(name);
      else tweens.set(name, tween);
      return groups;
    };
    groups.ease = function (value) {
      if (!arguments.length) return ease;
      ease = typeof value === "function" ? value : d3.ease.apply(d3, arguments);
      return groups;
    };
    groups.each = function (type, listener) {
      if (arguments.length < 2) return d3_transition_each.call(groups, type);
      event.on(type, listener);
      return groups;
    };
    d3.timer(
      function (elapsed) {
        return d3_selection_each(groups, function (node, i, j) {
          var tweened = [],
            delay = node.delay,
            duration = node.duration,
            lock =
              (node = node.node).__transition__ ||
              (node.__transition__ = { active: 0, count: 0 }),
            d = node.__data__;
          ++lock.count;
          delay <= elapsed ? start(elapsed) : d3.timer(start, delay, time);
          function start(elapsed) {
            if (lock.active > id) return stop();
            lock.active = id;
            tweens.forEach(function (key, value) {
              if ((value = value.call(node, d, i))) tweened.push(value);
            });
            event.start.call(node, d, i);
            if (!tick(elapsed)) d3.timer(tick, 0, time);
            return 1;
          }
          function tick(elapsed) {
            if (lock.active !== id) return stop();
            var t = (elapsed - delay) / duration,
              e = ease(t),
              n = tweened.length;
            while (n > 0) tweened[--n].call(node, e);
            if (t >= 1) {
              stop();
              d3_transitionId = id;
              event.end.call(node, d, i);
              d3_transitionId = 0;
              return 1;
            }
          }
          function stop() {
            if (!--lock.count) delete node.__transition__;
            return 1;
          }
        });
      },
      0,
      time
    );
    return groups;
  }
  var d3_transitionRemove = {};
  function d3_transitionNull(d, i, a) {
    return a != "" && d3_transitionRemove;
  }
  function d3_transitionTween(name, b) {
    var interpolate = d3_interpolateByName(name);
    function transitionFunction(d, i, a) {
      var v = b.call(this, d, i);
      return v == null
        ? a != "" && d3_transitionRemove
        : a != v && interpolate(a, v);
    }
    function transitionString(d, i, a) {
      return a != b && interpolate(a, b);
    }
    return typeof b === "function"
      ? transitionFunction
      : b == null
      ? d3_transitionNull
      : ((b += ""), transitionString);
  }
  var d3_transitionPrototype = [],
    d3_transitionNextId = 0,
    d3_transitionId = 0,
    d3_transitionDefaultDelay = 0,
    d3_transitionDefaultDuration = 250,
    d3_transitionDefaultEase = d3.ease("cubic-in-out"),
    d3_transitionDelay = d3_transitionDefaultDelay,
    d3_transitionDuration = d3_transitionDefaultDuration,
    d3_transitionEase = d3_transitionDefaultEase;
  d3_transitionPrototype.call = d3_selectionPrototype.call;
  d3.transition = function (selection) {
    return arguments.length
      ? d3_transitionId
        ? selection.transition()
        : selection
      : d3_selectionRoot.transition();
  };
  d3.transition.prototype = d3_transitionPrototype;
  d3_transitionPrototype.select = function (selector) {
    var subgroups = [],
      subgroup,
      subnode,
      node;
    if (typeof selector !== "function")
      selector = d3_selection_selector(selector);
    for (var j = -1, m = this.length; ++j < m; ) {
      subgroups.push((subgroup = []));
      for (var group = this[j], i = -1, n = group.length; ++i < n; )
        if (
          (node = group[i]) &&
          (subnode = selector.call(node.node, node.node.__data__, i))
        ) {
          if ("__data__" in node.node) subnode.__data__ = node.node.__data__;
          subgroup.push({
            node: subnode,
            delay: node.delay,
            duration: node.duration,
          });
        } else subgroup.push(null);
    }
    return d3_transition(subgroups, this.id, this.time).ease(this.ease());
  };
  d3_transitionPrototype.selectAll = function (selector) {
    var subgroups = [],
      subgroup,
      subnodes,
      node;
    if (typeof selector !== "function")
      selector = d3_selection_selectorAll(selector);
    for (var j = -1, m = this.length; ++j < m; )
      for (var group = this[j], i = -1, n = group.length; ++i < n; )
        if ((node = group[i])) {
          subnodes = selector.call(node.node, node.node.__data__, i);
          subgroups.push((subgroup = []));
          for (var k = -1, o = subnodes.length; ++k < o; )
            subgroup.push({
              node: subnodes[k],
              delay: node.delay,
              duration: node.duration,
            });
        }
    return d3_transition(subgroups, this.id, this.time).ease(this.ease());
  };
  d3_transitionPrototype.attr = function (name, value) {
    return this.attrTween(name, d3_transitionTween(name, value));
  };
  d3_transitionPrototype.attrTween = function (nameNS, tween) {
    var name = d3.ns.qualify(nameNS);
    function attrTween(d, i) {
      var f = tween.call(this, d, i, this.getAttribute(name));
      return f === d3_transitionRemove
        ? (this.removeAttribute(name), null)
        : f &&
            function (t) {
              this.setAttribute(name, f(t));
            };
    }
    function attrTweenNS(d, i) {
      var f = tween.call(
        this,
        d,
        i,
        this.getAttributeNS(name.space, name.local)
      );
      return f === d3_transitionRemove
        ? (this.removeAttributeNS(name.space, name.local), null)
        : f &&
            function (t) {
              this.setAttributeNS(name.space, name.local, f(t));
            };
    }
    return this.tween("attr." + nameNS, name.local ? attrTweenNS : attrTween);
  };
  d3_transitionPrototype.style = function (name, value, priority) {
    if (arguments.length < 3) priority = "";
    return this.styleTween(name, d3_transitionTween(name, value), priority);
  };
  d3_transitionPrototype.styleTween = function (name, tween, priority) {
    if (arguments.length < 3) priority = "";
    return this.tween("style." + name, function (d, i) {
      var f = tween.call(
        this,
        d,
        i,
        window.getComputedStyle(this, null).getPropertyValue(name)
      );
      return f === d3_transitionRemove
        ? (this.style.removeProperty(name), null)
        : f &&
            function (t) {
              this.style.setProperty(name, f(t), priority);
            };
    });
  };
  d3_transitionPrototype.text = function (value) {
    return this.tween("text", function (d, i) {
      this.textContent =
        typeof value === "function" ? value.call(this, d, i) : value;
    });
  };
  d3_transitionPrototype.remove = function () {
    return this.each("end.transition", function () {
      var p;
      if (!this.__transition__ && (p = this.parentNode)) p.removeChild(this);
    });
  };
  d3_transitionPrototype.delay = function (value) {
    return d3_selection_each(
      this,
      typeof value === "function"
        ? function (node, i, j) {
            node.delay =
              value.call((node = node.node), node.__data__, i, j) | 0;
          }
        : ((value = value | 0),
          function (node) {
            node.delay = value;
          })
    );
  };
  d3_transitionPrototype.duration = function (value) {
    return d3_selection_each(
      this,
      typeof value === "function"
        ? function (node, i, j) {
            node.duration = Math.max(
              1,
              value.call((node = node.node), node.__data__, i, j) | 0
            );
          }
        : ((value = Math.max(1, value | 0)),
          function (node) {
            node.duration = value;
          })
    );
  };
  function d3_transition_each(callback) {
    var id = d3_transitionId,
      ease = d3_transitionEase,
      delay = d3_transitionDelay,
      duration = d3_transitionDuration;
    d3_transitionId = this.id;
    d3_transitionEase = this.ease();
    d3_selection_each(this, function (node, i, j) {
      d3_transitionDelay = node.delay;
      d3_transitionDuration = node.duration;
      callback.call((node = node.node), node.__data__, i, j);
    });
    d3_transitionId = id;
    d3_transitionEase = ease;
    d3_transitionDelay = delay;
    d3_transitionDuration = duration;
    return this;
  }
  d3_transitionPrototype.transition = function () {
    return this.select(d3_this);
  };
  var d3_timer_queue = null,
    d3_timer_interval,
    d3_timer_timeout;
  d3.timer = function (callback, delay, then) {
    var found = false,
      t0,
      t1 = d3_timer_queue;
    if (arguments.length < 3) {
      if (arguments.length < 2) delay = 0;
      else if (!isFinite(delay)) return;
      then = Date.now();
    }
    while (t1) {
      if (t1.callback === callback) {
        t1.then = then;
        t1.delay = delay;
        found = true;
        break;
      }
      t0 = t1;
      t1 = t1.next;
    }
    if (!found)
      d3_timer_queue = {
        callback: callback,
        then: then,
        delay: delay,
        next: d3_timer_queue,
      };
    if (!d3_timer_interval) {
      d3_timer_timeout = clearTimeout(d3_timer_timeout);
      d3_timer_interval = 1;
      d3_timer_frame(d3_timer_step);
    }
  };
  function d3_timer_step() {
    var elapsed,
      now = Date.now(),
      t1 = d3_timer_queue;
    while (t1) {
      elapsed = now - t1.then;
      if (elapsed >= t1.delay) t1.flush = t1.callback(elapsed);
      t1 = t1.next;
    }
    var delay = d3_timer_flush() - now;
    if (delay > 24) {
      if (isFinite(delay)) {
        clearTimeout(d3_timer_timeout);
        d3_timer_timeout = setTimeout(d3_timer_step, delay);
      }
      d3_timer_interval = 0;
    } else {
      d3_timer_interval = 1;
      d3_timer_frame(d3_timer_step);
    }
  }
  d3.timer.flush = function () {
    var elapsed,
      now = Date.now(),
      t1 = d3_timer_queue;
    while (t1) {
      elapsed = now - t1.then;
      if (!t1.delay) t1.flush = t1.callback(elapsed);
      t1 = t1.next;
    }
    d3_timer_flush();
  };
  function d3_timer_flush() {
    var t0 = null,
      t1 = d3_timer_queue,
      then = Infinity;
    while (t1)
      if (t1.flush) t1 = t0 ? (t0.next = t1.next) : (d3_timer_queue = t1.next);
      else {
        then = Math.min(then, t1.then + t1.delay);
        t1 = (t0 = t1).next;
      }
    return then;
  }
  var d3_timer_frame =
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function (callback) {
      setTimeout(callback, 17);
    };
  d3.transform = function (string) {
    var g = document.createElementNS(d3.ns.prefix.svg, "g"),
      identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    return (d3.transform = function (string) {
      g.setAttribute("transform", string);
      var t = g.transform.baseVal.consolidate();
      return new d3_transform(t ? t.matrix : identity);
    })(string);
  };
  function d3_transform(m) {
    var r0 = [m.a, m.b],
      r1 = [m.c, m.d],
      kx = d3_transformNormalize(r0),
      kz = d3_transformDot(r0, r1),
      ky = d3_transformNormalize(d3_transformCombine(r1, r0, -kz)) || 0;
    if (r0[0] * r1[1] < r1[0] * r0[1]) {
      r0[0] *= -1;
      r0[1] *= -1;
      kx *= -1;
      kz *= -1;
    }
    this.rotate =
      (kx ? Math.atan2(r0[1], r0[0]) : Math.atan2(-r1[0], r1[1])) *
      d3_transformDegrees;
    this.translate = [m.e, m.f];
    this.scale = [kx, ky];
    this.skew = ky ? Math.atan2(kz, ky) * d3_transformDegrees : 0;
  }
  d3_transform.prototype.toString = function () {
    return (
      "translate(" +
      this.translate +
      ")rotate(" +
      this.rotate +
      ")skewX(" +
      this.skew +
      ")scale(" +
      this.scale +
      ")"
    );
  };
  function d3_transformDot(a, b) {
    return a[0] * b[0] + a[1] * b[1];
  }
  function d3_transformNormalize(a) {
    var k = Math.sqrt(d3_transformDot(a, a));
    if (k) {
      a[0] /= k;
      a[1] /= k;
    }
    return k;
  }
  function d3_transformCombine(a, b, k) {
    a[0] += k * b[0];
    a[1] += k * b[1];
    return a;
  }
  var d3_transformDegrees = 180 / Math.PI;
  d3.mouse = function (container) {
    return d3_mousePoint(container, d3_eventSource());
  };
  var d3_mouse_bug44083 = /WebKit/.test(navigator.userAgent) ? -1 : 0;
  function d3_mousePoint(container, e) {
    var svg = container.ownerSVGElement || container;
    if (svg.createSVGPoint) {
      var point = svg.createSVGPoint();
      if (d3_mouse_bug44083 < 0 && (window.scrollX || window.scrollY)) {
        svg = d3
          .select(document.body)
          .append("svg")
          .style("position", "absolute")
          .style("top", 0)
          .style("left", 0);
        var ctm = svg[0][0].getScreenCTM();
        d3_mouse_bug44083 = !(ctm.f || ctm.e);
        svg.remove();
      }
      if (d3_mouse_bug44083) {
        point.x = e.pageX;
        point.y = e.pageY;
      } else {
        point.x = e.clientX;
        point.y = e.clientY;
      }
      point = point.matrixTransform(container.getScreenCTM().inverse());
      return [point.x, point.y];
    }
    var rect = container.getBoundingClientRect();
    return [
      e.clientX - rect.left - container.clientLeft,
      e.clientY - rect.top - container.clientTop,
    ];
  }
  d3.touches = function (container, touches) {
    if (arguments.length < 2) touches = d3_eventSource().touches;
    return touches
      ? d3_array(touches).map(function (touch) {
          var point = d3_mousePoint(container, touch);
          point.identifier = touch.identifier;
          return point;
        })
      : [];
  };
  function d3_noop() {}
  d3.scale = {};
  function d3_scaleExtent(domain) {
    var start = domain[0],
      stop = domain[domain.length - 1];
    return start < stop ? [start, stop] : [stop, start];
  }
  function d3_scaleRange(scale) {
    return scale.rangeExtent
      ? scale.rangeExtent()
      : d3_scaleExtent(scale.range());
  }
  function d3_scale_nice(domain, nice) {
    var i0 = 0,
      i1 = domain.length - 1,
      x0 = domain[i0],
      x1 = domain[i1],
      dx;
    if (x1 < x0) {
      dx = i0;
      i0 = i1;
      i1 = dx;
      dx = x0;
      x0 = x1;
      x1 = dx;
    }
    if ((dx = x1 - x0)) {
      nice = nice(dx);
      domain[i0] = nice.floor(x0);
      domain[i1] = nice.ceil(x1);
    }
    return domain;
  }
  function d3_scale_niceDefault() {
    return Math;
  }
  d3.scale.linear = function () {
    return d3_scale_linear([0, 1], [0, 1], d3.interpolate, false);
  };
  function d3_scale_linear(domain, range, interpolate, clamp) {
    var output, input;
    function rescale() {
      var linear =
          Math.min(domain.length, range.length) > 2
            ? d3_scale_polylinear
            : d3_scale_bilinear,
        uninterpolate = clamp ? d3_uninterpolateClamp : d3_uninterpolateNumber;
      output = linear(domain, range, uninterpolate, interpolate);
      input = linear(range, domain, uninterpolate, d3.interpolate);
      return scale;
    }
    function scale(x) {
      return output(x);
    }
    scale.invert = function (y) {
      return input(y);
    };
    scale.domain = function (x) {
      if (!arguments.length) return domain;
      domain = x.map(Number);
      return rescale();
    };
    scale.range = function (x) {
      if (!arguments.length) return range;
      range = x;
      return rescale();
    };
    scale.rangeRound = function (x) {
      return scale.range(x).interpolate(d3.interpolateRound);
    };
    scale.clamp = function (x) {
      if (!arguments.length) return clamp;
      clamp = x;
      return rescale();
    };
    scale.interpolate = function (x) {
      if (!arguments.length) return interpolate;
      interpolate = x;
      return rescale();
    };
    scale.ticks = function (m) {
      return d3_scale_linearTicks(domain, m);
    };
    scale.tickFormat = function (m) {
      return d3_scale_linearTickFormat(domain, m);
    };
    scale.nice = function () {
      d3_scale_nice(domain, d3_scale_linearNice);
      return rescale();
    };
    scale.copy = function () {
      return d3_scale_linear(domain, range, interpolate, clamp);
    };
    return rescale();
  }
  function d3_scale_linearRebind(scale, linear) {
    return d3.rebind(
      scale,
      linear,
      "range",
      "rangeRound",
      "interpolate",
      "clamp"
    );
  }
  function d3_scale_linearNice(dx) {
    dx = Math.pow(10, Math.round(Math.log(dx) / Math.LN10) - 1);
    return {
      floor: function (x) {
        return Math.floor(x / dx) * dx;
      },
      ceil: function (x) {
        return Math.ceil(x / dx) * dx;
      },
    };
  }
  function d3_scale_linearTickRange(domain, m) {
    var extent = d3_scaleExtent(domain),
      span = extent[1] - extent[0],
      step = Math.pow(10, Math.floor(Math.log(span / m) / Math.LN10)),
      err = (m / span) * step;
    if (err <= 0.15) step *= 10;
    else if (err <= 0.35) step *= 5;
    else if (err <= 0.75) step *= 2;
    extent[0] = Math.ceil(extent[0] / step) * step;
    extent[1] = Math.floor(extent[1] / step) * step + step * 0.5;
    extent[2] = step;
    return extent;
  }
  function d3_scale_linearTicks(domain, m) {
    return d3.range.apply(d3, d3_scale_linearTickRange(domain, m));
  }
  function d3_scale_linearTickFormat(domain, m) {
    return d3.format(
      ",." +
        Math.max(
          0,
          -Math.floor(
            Math.log(d3_scale_linearTickRange(domain, m)[2]) / Math.LN10 + 0.01
          )
        ) +
        "f"
    );
  }
  function d3_scale_bilinear(domain, range, uninterpolate, interpolate) {
    var u = uninterpolate(domain[0], domain[1]),
      i = interpolate(range[0], range[1]);
    return function (x) {
      return i(u(x));
    };
  }
  function d3_scale_polylinear(domain, range, uninterpolate, interpolate) {
    var u = [],
      i = [],
      j = 0,
      k = Math.min(domain.length, range.length) - 1;
    if (domain[k] < domain[0]) {
      domain = domain.slice().reverse();
      range = range.slice().reverse();
    }
    while (++j <= k) {
      u.push(uninterpolate(domain[j - 1], domain[j]));
      i.push(interpolate(range[j - 1], range[j]));
    }
    return function (x) {
      var j = d3.bisect(domain, x, 1, k) - 1;
      return i[j](u[j](x));
    };
  }
  d3.scale.log = function () {
    return d3_scale_log(d3.scale.linear(), d3_scale_logp);
  };
  function d3_scale_log(linear, log) {
    var pow = log.pow;
    function scale(x) {
      return linear(log(x));
    }
    scale.invert = function (x) {
      return pow(linear.invert(x));
    };
    scale.domain = function (x) {
      if (!arguments.length) return linear.domain().map(pow);
      log = x[0] < 0 ? d3_scale_logn : d3_scale_logp;
      pow = log.pow;
      linear.domain(x.map(log));
      return scale;
    };
    scale.nice = function () {
      linear.domain(d3_scale_nice(linear.domain(), d3_scale_niceDefault));
      return scale;
    };
    scale.ticks = function () {
      var extent = d3_scaleExtent(linear.domain()),
        ticks = [];
      if (extent.every(isFinite)) {
        var i = Math.floor(extent[0]),
          j = Math.ceil(extent[1]),
          u = pow(extent[0]),
          v = pow(extent[1]);
        if (log === d3_scale_logn) {
          ticks.push(pow(i));
          for (; i++ < j; ) for (var k = 9; k > 0; k--) ticks.push(pow(i) * k);
        } else {
          for (; i < j; i++)
            for (var k = 1; k < 10; k++) ticks.push(pow(i) * k);
          ticks.push(pow(i));
        }
        for (i = 0; ticks[i] < u; i++);
        for (j = ticks.length; ticks[j - 1] > v; j--);
        ticks = ticks.slice(i, j);
      }
      return ticks;
    };
    scale.tickFormat = function (n, format) {
      if (arguments.length < 2) format = d3_scale_logFormat;
      if (arguments.length < 1) return format;
      var k = Math.max(0.1, n / scale.ticks().length),
        f =
          log === d3_scale_logn
            ? ((e = -1e-12), Math.floor)
            : ((e = 1e-12), Math.ceil),
        e;
      return function (d) {
        return d / pow(f(log(d) + e)) <= k ? format(d) : "";
      };
    };
    scale.copy = function () {
      return d3_scale_log(linear.copy(), log);
    };
    return d3_scale_linearRebind(scale, linear);
  }
  var d3_scale_logFormat = d3.format(".0e");
  function d3_scale_logp(x) {
    return Math.log(x < 0 ? 0 : x) / Math.LN10;
  }
  function d3_scale_logn(x) {
    return -Math.log(x > 0 ? 0 : -x) / Math.LN10;
  }
  d3_scale_logp.pow = function (x) {
    return Math.pow(10, x);
  };
  d3_scale_logn.pow = function (x) {
    return -Math.pow(10, -x);
  };
  d3.scale.pow = function () {
    return d3_scale_pow(d3.scale.linear(), 1);
  };
  function d3_scale_pow(linear, exponent) {
    var powp = d3_scale_powPow(exponent),
      powb = d3_scale_powPow(1 / exponent);
    function scale(x) {
      return linear(powp(x));
    }
    scale.invert = function (x) {
      return powb(linear.invert(x));
    };
    scale.domain = function (x) {
      if (!arguments.length) return linear.domain().map(powb);
      linear.domain(x.map(powp));
      return scale;
    };
    scale.ticks = function (m) {
      return d3_scale_linearTicks(scale.domain(), m);
    };
    scale.tickFormat = function (m) {
      return d3_scale_linearTickFormat(scale.domain(), m);
    };
    scale.nice = function () {
      return scale.domain(d3_scale_nice(scale.domain(), d3_scale_linearNice));
    };
    scale.exponent = function (x) {
      if (!arguments.length) return exponent;
      var domain = scale.domain();
      powp = d3_scale_powPow((exponent = x));
      powb = d3_scale_powPow(1 / exponent);
      return scale.domain(domain);
    };
    scale.copy = function () {
      return d3_scale_pow(linear.copy(), exponent);
    };
    return d3_scale_linearRebind(scale, linear);
  }
  function d3_scale_powPow(e) {
    return function (x) {
      return x < 0 ? -Math.pow(-x, e) : Math.pow(x, e);
    };
  }
  d3.scale.sqrt = function () {
    return d3.scale.pow().exponent(0.5);
  };
  d3.scale.ordinal = function () {
    return d3_scale_ordinal([], { t: "range", x: [] });
  };
  function d3_scale_ordinal(domain, ranger) {
    var index, range, rangeBand;
    function scale(x) {
      return range[
        ((index.get(x) || index.set(x, domain.push(x))) - 1) % range.length
      ];
    }
    function steps(start, step) {
      return d3.range(domain.length).map(function (i) {
        return start + step * i;
      });
    }
    scale.domain = function (x) {
      if (!arguments.length) return domain;
      domain = [];
      index = new d3_Map();
      var i = -1,
        n = x.length,
        xi;
      while (++i < n)
        if (!index.has((xi = x[i]))) index.set(xi, domain.push(xi));
      return scale[ranger.t](ranger.x, ranger.p);
    };
    scale.range = function (x) {
      if (!arguments.length) return range;
      range = x;
      rangeBand = 0;
      ranger = { t: "range", x: x };
      return scale;
    };
    scale.rangePoints = function (x, padding) {
      if (arguments.length < 2) padding = 0;
      var start = x[0],
        stop = x[1],
        step = (stop - start) / (domain.length - 1 + padding);
      range = steps(
        domain.length < 2 ? (start + stop) / 2 : start + (step * padding) / 2,
        step
      );
      rangeBand = 0;
      ranger = { t: "rangePoints", x: x, p: padding };
      return scale;
    };
    scale.rangeBands = function (x, padding) {
      if (arguments.length < 2) padding = 0;
      var reverse = x[1] < x[0],
        start = x[reverse - 0],
        stop = x[1 - reverse],
        step = (stop - start) / (domain.length + padding);
      range = steps(start + step * padding, step);
      if (reverse) range.reverse();
      rangeBand = step * (1 - padding);
      ranger = { t: "rangeBands", x: x, p: padding };
      return scale;
    };
    scale.rangeRoundBands = function (x, padding) {
      if (arguments.length < 2) padding = 0;
      var reverse = x[1] < x[0],
        start = x[reverse - 0],
        stop = x[1 - reverse],
        step = Math.floor((stop - start) / (domain.length + padding)),
        error = stop - start - (domain.length - padding) * step;
      range = steps(start + Math.round(error / 2), step);
      if (reverse) range.reverse();
      rangeBand = Math.round(step * (1 - padding));
      ranger = { t: "rangeRoundBands", x: x, p: padding };
      return scale;
    };
    scale.rangeBand = function () {
      return rangeBand;
    };
    scale.rangeExtent = function () {
      return d3_scaleExtent(ranger.x);
    };
    scale.copy = function () {
      return d3_scale_ordinal(domain, ranger);
    };
    return scale.domain(domain);
  }
  d3.scale.category10 = function () {
    return d3.scale.ordinal().range(d3_category10);
  };
  d3.scale.category20 = function () {
    return d3.scale.ordinal().range(d3_category20);
  };
  d3.scale.category20b = function () {
    return d3.scale.ordinal().range(d3_category20b);
  };
  d3.scale.category20c = function () {
    return d3.scale.ordinal().range(d3_category20c);
  };
  var d3_category10 = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
  ];
  var d3_category20 = [
    "#1f77b4",
    "#aec7e8",
    "#ff7f0e",
    "#ffbb78",
    "#2ca02c",
    "#98df8a",
    "#d62728",
    "#ff9896",
    "#9467bd",
    "#c5b0d5",
    "#8c564b",
    "#c49c94",
    "#e377c2",
    "#f7b6d2",
    "#7f7f7f",
    "#c7c7c7",
    "#bcbd22",
    "#dbdb8d",
    "#17becf",
    "#9edae5",
  ];
  var d3_category20b = [
    "#393b79",
    "#5254a3",
    "#6b6ecf",
    "#9c9ede",
    "#637939",
    "#8ca252",
    "#b5cf6b",
    "#cedb9c",
    "#8c6d31",
    "#bd9e39",
    "#e7ba52",
    "#e7cb94",
    "#843c39",
    "#ad494a",
    "#d6616b",
    "#e7969c",
    "#7b4173",
    "#a55194",
    "#ce6dbd",
    "#de9ed6",
  ];
  var d3_category20c = [
    "#3182bd",
    "#6baed6",
    "#9ecae1",
    "#c6dbef",
    "#e6550d",
    "#fd8d3c",
    "#fdae6b",
    "#fdd0a2",
    "#31a354",
    "#74c476",
    "#a1d99b",
    "#c7e9c0",
    "#756bb1",
    "#9e9ac8",
    "#bcbddc",
    "#dadaeb",
    "#636363",
    "#969696",
    "#bdbdbd",
    "#d9d9d9",
  ];
  d3.scale.quantile = function () {
    return d3_scale_quantile([], []);
  };
  function d3_scale_quantile(domain, range) {
    var thresholds;
    function rescale() {
      var k = 0,
        n = domain.length,
        q = range.length;
      thresholds = [];
      while (++k < q) thresholds[k - 1] = d3.quantile(domain, k / q);
      return scale;
    }
    function scale(x) {
      if (isNaN((x = +x))) return NaN;
      return range[d3.bisect(thresholds, x)];
    }
    scale.domain = function (x) {
      if (!arguments.length) return domain;
      domain = x
        .filter(function (d) {
          return !isNaN(d);
        })
        .sort(d3.ascending);
      return rescale();
    };
    scale.range = function (x) {
      if (!arguments.length) return range;
      range = x;
      return rescale();
    };
    scale.quantiles = function () {
      return thresholds;
    };
    scale.copy = function () {
      return d3_scale_quantile(domain, range);
    };
    return rescale();
  }
  d3.scale.quantize = function () {
    return d3_scale_quantize(0, 1, [0, 1]);
  };
  function d3_scale_quantize(x0, x1, range) {
    var kx, i;
    function scale(x) {
      return range[Math.max(0, Math.min(i, Math.floor(kx * (x - x0))))];
    }
    function rescale() {
      kx = range.length / (x1 - x0);
      i = range.length - 1;
      return scale;
    }
    scale.domain = function (x) {
      if (!arguments.length) return [x0, x1];
      x0 = +x[0];
      x1 = +x[x.length - 1];
      return rescale();
    };
    scale.range = function (x) {
      if (!arguments.length) return range;
      range = x;
      return rescale();
    };
    scale.copy = function () {
      return d3_scale_quantize(x0, x1, range);
    };
    return rescale();
  }
  d3.scale.identity = function () {
    return d3_scale_identity([0, 1]);
  };
  function d3_scale_identity(domain) {
    function identity(x) {
      return +x;
    }
    identity.invert = identity;
    identity.domain = identity.range = function (x) {
      if (!arguments.length) return domain;
      domain = x.map(identity);
      return identity;
    };
    identity.ticks = function (m) {
      return d3_scale_linearTicks(domain, m);
    };
    identity.tickFormat = function (m) {
      return d3_scale_linearTickFormat(domain, m);
    };
    identity.copy = function () {
      return d3_scale_identity(domain);
    };
    return identity;
  }
  d3.svg = {};
  d3.svg.arc = function () {
    var innerRadius = d3_svg_arcInnerRadius,
      outerRadius = d3_svg_arcOuterRadius,
      startAngle = d3_svg_arcStartAngle,
      endAngle = d3_svg_arcEndAngle;
    function arc() {
      var r0 = innerRadius.apply(this, arguments),
        r1 = outerRadius.apply(this, arguments),
        a0 = startAngle.apply(this, arguments) + d3_svg_arcOffset,
        a1 = endAngle.apply(this, arguments) + d3_svg_arcOffset,
        da = (a1 < a0 && ((da = a0), (a0 = a1), (a1 = da)), a1 - a0),
        df = da < Math.PI ? "0" : "1",
        c0 = Math.cos(a0),
        s0 = Math.sin(a0),
        c1 = Math.cos(a1),
        s1 = Math.sin(a1);
      return da >= d3_svg_arcMax
        ? r0
          ? "M0," +
            r1 +
            "A" +
            r1 +
            "," +
            r1 +
            " 0 1,1 0," +
            -r1 +
            "A" +
            r1 +
            "," +
            r1 +
            " 0 1,1 0," +
            r1 +
            "M0," +
            r0 +
            "A" +
            r0 +
            "," +
            r0 +
            " 0 1,0 0," +
            -r0 +
            "A" +
            r0 +
            "," +
            r0 +
            " 0 1,0 0," +
            r0 +
            "Z"
          : "M0," +
            r1 +
            "A" +
            r1 +
            "," +
            r1 +
            " 0 1,1 0," +
            -r1 +
            "A" +
            r1 +
            "," +
            r1 +
            " 0 1,1 0," +
            r1 +
            "Z"
        : r0
        ? "M" +
          r1 * c0 +
          "," +
          r1 * s0 +
          "A" +
          r1 +
          "," +
          r1 +
          " 0 " +
          df +
          ",1 " +
          r1 * c1 +
          "," +
          r1 * s1 +
          "L" +
          r0 * c1 +
          "," +
          r0 * s1 +
          "A" +
          r0 +
          "," +
          r0 +
          " 0 " +
          df +
          ",0 " +
          r0 * c0 +
          "," +
          r0 * s0 +
          "Z"
        : "M" +
          r1 * c0 +
          "," +
          r1 * s0 +
          "A" +
          r1 +
          "," +
          r1 +
          " 0 " +
          df +
          ",1 " +
          r1 * c1 +
          "," +
          r1 * s1 +
          "L0,0" +
          "Z";
    }
    arc.innerRadius = function (v) {
      if (!arguments.length) return innerRadius;
      innerRadius = d3_functor(v);
      return arc;
    };
    arc.outerRadius = function (v) {
      if (!arguments.length) return outerRadius;
      outerRadius = d3_functor(v);
      return arc;
    };
    arc.startAngle = function (v) {
      if (!arguments.length) return startAngle;
      startAngle = d3_functor(v);
      return arc;
    };
    arc.endAngle = function (v) {
      if (!arguments.length) return endAngle;
      endAngle = d3_functor(v);
      return arc;
    };
    arc.centroid = function () {
      var r =
          (innerRadius.apply(this, arguments) +
            outerRadius.apply(this, arguments)) /
          2,
        a =
          (startAngle.apply(this, arguments) +
            endAngle.apply(this, arguments)) /
            2 +
          d3_svg_arcOffset;
      return [Math.cos(a) * r, Math.sin(a) * r];
    };
    return arc;
  };
  var d3_svg_arcOffset = -Math.PI / 2,
    d3_svg_arcMax = 2 * Math.PI - 1e-6;
  function d3_svg_arcInnerRadius(d) {
    return d.innerRadius;
  }
  function d3_svg_arcOuterRadius(d) {
    return d.outerRadius;
  }
  function d3_svg_arcStartAngle(d) {
    return d.startAngle;
  }
  function d3_svg_arcEndAngle(d) {
    return d.endAngle;
  }
  function d3_svg_line(projection) {
    var x = d3_svg_lineX,
      y = d3_svg_lineY,
      defined = d3_true,
      interpolate = d3_svg_lineInterpolatorDefault,
      interpolator = d3_svg_lineLinear,
      tension = 0.7;
    function line(data) {
      var segments = [],
        points = [],
        i = -1,
        n = data.length,
        d,
        fx = d3_functor(x),
        fy = d3_functor(y);
      function segment() {
        segments.push("M", interpolator(projection(points), tension));
      }
      while (++i < n)
        if (defined.call(this, (d = data[i]), i))
          points.push([+fx.call(this, d, i), +fy.call(this, d, i)]);
        else if (points.length) {
          segment();
          points = [];
        }
      if (points.length) segment();
      return segments.length ? segments.join("") : null;
    }
    line.x = function (_) {
      if (!arguments.length) return x;
      x = _;
      return line;
    };
    line.y = function (_) {
      if (!arguments.length) return y;
      y = _;
      return line;
    };
    line.defined = function (_) {
      if (!arguments.length) return defined;
      defined = _;
      return line;
    };
    line.interpolate = function (_) {
      if (!arguments.length) return interpolate;
      if (!d3_svg_lineInterpolators.has((_ += "")))
        _ = d3_svg_lineInterpolatorDefault;
      interpolator = d3_svg_lineInterpolators.get((interpolate = _));
      return line;
    };
    line.tension = function (_) {
      if (!arguments.length) return tension;
      tension = _;
      return line;
    };
    return line;
  }
  d3.svg.line = function () {
    return d3_svg_line(d3_identity);
  };
  function d3_svg_lineX(d) {
    return d[0];
  }
  function d3_svg_lineY(d) {
    return d[1];
  }
  var d3_svg_lineInterpolatorDefault = "linear";
  var d3_svg_lineInterpolators = d3.map({
    linear: d3_svg_lineLinear,
    "step-before": d3_svg_lineStepBefore,
    "step-after": d3_svg_lineStepAfter,
    basis: d3_svg_lineBasis,
    "basis-open": d3_svg_lineBasisOpen,
    "basis-closed": d3_svg_lineBasisClosed,
    bundle: d3_svg_lineBundle,
    cardinal: d3_svg_lineCardinal,
    "cardinal-open": d3_svg_lineCardinalOpen,
    "cardinal-closed": d3_svg_lineCardinalClosed,
    monotone: d3_svg_lineMonotone,
  });
  function d3_svg_lineLinear(points) {
    var i = 0,
      n = points.length,
      p = points[0],
      path = [p[0], ",", p[1]];
    while (++i < n) path.push("L", (p = points[i])[0], ",", p[1]);
    return path.join("");
  }
  function d3_svg_lineStepBefore(points) {
    var i = 0,
      n = points.length,
      p = points[0],
      path = [p[0], ",", p[1]];
    while (++i < n) path.push("V", (p = points[i])[1], "H", p[0]);
    return path.join("");
  }
  function d3_svg_lineStepAfter(points) {
    var i = 0,
      n = points.length,
      p = points[0],
      path = [p[0], ",", p[1]];
    while (++i < n) path.push("H", (p = points[i])[0], "V", p[1]);
    return path.join("");
  }
  function d3_svg_lineCardinalOpen(points, tension) {
    return points.length < 4
      ? d3_svg_lineLinear(points)
      : points[1] +
          d3_svg_lineHermite(
            points.slice(1, points.length - 1),
            d3_svg_lineCardinalTangents(points, tension)
          );
  }
  function d3_svg_lineCardinalClosed(points, tension) {
    return points.length < 3
      ? d3_svg_lineLinear(points)
      : points[0] +
          d3_svg_lineHermite(
            (points.push(points[0]), points),
            d3_svg_lineCardinalTangents(
              [points[points.length - 2]].concat(points, [points[1]]),
              tension
            )
          );
  }
  function d3_svg_lineCardinal(points, tension, closed) {
    return points.length < 3
      ? d3_svg_lineLinear(points)
      : points[0] +
          d3_svg_lineHermite(
            points,
            d3_svg_lineCardinalTangents(points, tension)
          );
  }
  function d3_svg_lineHermite(points, tangents) {
    if (
      tangents.length < 1 ||
      (points.length != tangents.length && points.length != tangents.length + 2)
    )
      return d3_svg_lineLinear(points);
    var quad = points.length != tangents.length,
      path = "",
      p0 = points[0],
      p = points[1],
      t0 = tangents[0],
      t = t0,
      pi = 1;
    if (quad) {
      path +=
        "Q" +
        (p[0] - (t0[0] * 2) / 3) +
        "," +
        (p[1] - (t0[1] * 2) / 3) +
        "," +
        p[0] +
        "," +
        p[1];
      p0 = points[1];
      pi = 2;
    }
    if (tangents.length > 1) {
      t = tangents[1];
      p = points[pi];
      pi++;
      path +=
        "C" +
        (p0[0] + t0[0]) +
        "," +
        (p0[1] + t0[1]) +
        "," +
        (p[0] - t[0]) +
        "," +
        (p[1] - t[1]) +
        "," +
        p[0] +
        "," +
        p[1];
      for (var i = 2; i < tangents.length; i++, pi++) {
        p = points[pi];
        t = tangents[i];
        path +=
          "S" + (p[0] - t[0]) + "," + (p[1] - t[1]) + "," + p[0] + "," + p[1];
      }
    }
    if (quad) {
      var lp = points[pi];
      path +=
        "Q" +
        (p[0] + (t[0] * 2) / 3) +
        "," +
        (p[1] + (t[1] * 2) / 3) +
        "," +
        lp[0] +
        "," +
        lp[1];
    }
    return path;
  }
  function d3_svg_lineCardinalTangents(points, tension) {
    var tangents = [],
      a = (1 - tension) / 2,
      p0,
      p1 = points[0],
      p2 = points[1],
      i = 1,
      n = points.length;
    while (++i < n) {
      p0 = p1;
      p1 = p2;
      p2 = points[i];
      tangents.push([a * (p2[0] - p0[0]), a * (p2[1] - p0[1])]);
    }
    return tangents;
  }
  function d3_svg_lineBasis(points) {
    if (points.length < 3) return d3_svg_lineLinear(points);
    var i = 1,
      n = points.length,
      pi = points[0],
      x0 = pi[0],
      y0 = pi[1],
      px = [x0, x0, x0, (pi = points[1])[0]],
      py = [y0, y0, y0, pi[1]],
      path = [x0, ",", y0];
    d3_svg_lineBasisBezier(path, px, py);
    while (++i < n) {
      pi = points[i];
      px.shift();
      px.push(pi[0]);
      py.shift();
      py.push(pi[1]);
      d3_svg_lineBasisBezier(path, px, py);
    }
    i = -1;
    while (++i < 2) {
      px.shift();
      px.push(pi[0]);
      py.shift();
      py.push(pi[1]);
      d3_svg_lineBasisBezier(path, px, py);
    }
    return path.join("");
  }
  function d3_svg_lineBasisOpen(points) {
    if (points.length < 4) return d3_svg_lineLinear(points);
    var path = [],
      i = -1,
      n = points.length,
      pi,
      px = [0],
      py = [0];
    while (++i < 3) {
      pi = points[i];
      px.push(pi[0]);
      py.push(pi[1]);
    }
    path.push(
      d3_svg_lineDot4(d3_svg_lineBasisBezier3, px) +
        "," +
        d3_svg_lineDot4(d3_svg_lineBasisBezier3, py)
    );
    --i;
    while (++i < n) {
      pi = points[i];
      px.shift();
      px.push(pi[0]);
      py.shift();
      py.push(pi[1]);
      d3_svg_lineBasisBezier(path, px, py);
    }
    return path.join("");
  }
  function d3_svg_lineBasisClosed(points) {
    var path,
      i = -1,
      n = points.length,
      m = n + 4,
      pi,
      px = [],
      py = [];
    while (++i < 4) {
      pi = points[i % n];
      px.push(pi[0]);
      py.push(pi[1]);
    }
    path = [
      d3_svg_lineDot4(d3_svg_lineBasisBezier3, px),
      ",",
      d3_svg_lineDot4(d3_svg_lineBasisBezier3, py),
    ];
    --i;
    while (++i < m) {
      pi = points[i % n];
      px.shift();
      px.push(pi[0]);
      py.shift();
      py.push(pi[1]);
      d3_svg_lineBasisBezier(path, px, py);
    }
    return path.join("");
  }
  function d3_svg_lineBundle(points, tension) {
    var n = points.length - 1;
    if (n) {
      var x0 = points[0][0],
        y0 = points[0][1],
        dx = points[n][0] - x0,
        dy = points[n][1] - y0,
        i = -1,
        p,
        t;
      while (++i <= n) {
        p = points[i];
        t = i / n;
        p[0] = tension * p[0] + (1 - tension) * (x0 + t * dx);
        p[1] = tension * p[1] + (1 - tension) * (y0 + t * dy);
      }
    }
    return d3_svg_lineBasis(points);
  }
  function d3_svg_lineDot4(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  }
  var d3_svg_lineBasisBezier1 = [0, 2 / 3, 1 / 3, 0],
    d3_svg_lineBasisBezier2 = [0, 1 / 3, 2 / 3, 0],
    d3_svg_lineBasisBezier3 = [0, 1 / 6, 2 / 3, 1 / 6];
  function d3_svg_lineBasisBezier(path, x, y) {
    path.push(
      "C",
      d3_svg_lineDot4(d3_svg_lineBasisBezier1, x),
      ",",
      d3_svg_lineDot4(d3_svg_lineBasisBezier1, y),
      ",",
      d3_svg_lineDot4(d3_svg_lineBasisBezier2, x),
      ",",
      d3_svg_lineDot4(d3_svg_lineBasisBezier2, y),
      ",",
      d3_svg_lineDot4(d3_svg_lineBasisBezier3, x),
      ",",
      d3_svg_lineDot4(d3_svg_lineBasisBezier3, y)
    );
  }
  function d3_svg_lineSlope(p0, p1) {
    return (p1[1] - p0[1]) / (p1[0] - p0[0]);
  }
  function d3_svg_lineFiniteDifferences(points) {
    var i = 0,
      j = points.length - 1,
      m = [],
      p0 = points[0],
      p1 = points[1],
      d = (m[0] = d3_svg_lineSlope(p0, p1));
    while (++i < j)
      m[i] = d + (d = d3_svg_lineSlope((p0 = p1), (p1 = points[i + 1])));
    m[i] = d;
    return m;
  }
  function d3_svg_lineMonotoneTangents(points) {
    var tangents = [],
      d,
      a,
      b,
      s,
      m = d3_svg_lineFiniteDifferences(points),
      i = -1,
      j = points.length - 1;
    while (++i < j) {
      d = d3_svg_lineSlope(points[i], points[i + 1]);
      if (Math.abs(d) < 1e-6) m[i] = m[i + 1] = 0;
      else {
        a = m[i] / d;
        b = m[i + 1] / d;
        s = a * a + b * b;
        if (s > 9) {
          s = (d * 3) / Math.sqrt(s);
          m[i] = s * a;
          m[i + 1] = s * b;
        }
      }
    }
    i = -1;
    while (++i <= j) {
      s =
        (points[Math.min(j, i + 1)][0] - points[Math.max(0, i - 1)][0]) /
        (6 * (1 + m[i] * m[i]));
      tangents.push([s || 0, m[i] * s || 0]);
    }
    return tangents;
  }
  function d3_svg_lineMonotone(points) {
    return points.length < 3
      ? d3_svg_lineLinear(points)
      : points[0] +
          d3_svg_lineHermite(points, d3_svg_lineMonotoneTangents(points));
  }
  d3.svg.line.radial = function () {
    var line = d3_svg_line(d3_svg_lineRadial);
    (line.radius = line.x), delete line.x;
    (line.angle = line.y), delete line.y;
    return line;
  };
  function d3_svg_lineRadial(points) {
    var point,
      i = -1,
      n = points.length,
      r,
      a;
    while (++i < n) {
      point = points[i];
      r = point[0];
      a = point[1] + d3_svg_arcOffset;
      point[0] = r * Math.cos(a);
      point[1] = r * Math.sin(a);
    }
    return points;
  }
  function d3_svg_area(projection) {
    var x0 = d3_svg_lineX,
      x1 = d3_svg_lineX,
      y0 = 0,
      y1 = d3_svg_lineY,
      defined = d3_true,
      interpolate = d3_svg_lineInterpolatorDefault,
      i0 = d3_svg_lineLinear,
      i1 = d3_svg_lineLinear,
      L = "L",
      tension = 0.7;
    function area(data) {
      var segments = [],
        points0 = [],
        points1 = [],
        i = -1,
        n = data.length,
        d,
        fx0 = d3_functor(x0),
        fy0 = d3_functor(y0),
        fx1 =
          x0 === x1
            ? function () {
                return x;
              }
            : d3_functor(x1),
        fy1 =
          y0 === y1
            ? function () {
                return y;
              }
            : d3_functor(y1),
        x,
        y;
      function segment() {
        segments.push(
          "M",
          i0(projection(points1), tension),
          L,
          i1(projection(points0.reverse()), tension),
          "Z"
        );
      }
      while (++i < n)
        if (defined.call(this, (d = data[i]), i)) {
          points0.push([
            (x = +fx0.call(this, d, i)),
            (y = +fy0.call(this, d, i)),
          ]);
          points1.push([+fx1.call(this, d, i), +fy1.call(this, d, i)]);
        } else if (points0.length) {
          segment();
          points0 = [];
          points1 = [];
        }
      if (points0.length) segment();
      return segments.length ? segments.join("") : null;
    }
    area.x = function (_) {
      if (!arguments.length) return x1;
      x0 = x1 = _;
      return area;
    };
    area.x0 = function (_) {
      if (!arguments.length) return x0;
      x0 = _;
      return area;
    };
    area.x1 = function (_) {
      if (!arguments.length) return x1;
      x1 = _;
      return area;
    };
    area.y = function (_) {
      if (!arguments.length) return y1;
      y0 = y1 = _;
      return area;
    };
    area.y0 = function (_) {
      if (!arguments.length) return y0;
      y0 = _;
      return area;
    };
    area.y1 = function (_) {
      if (!arguments.length) return y1;
      y1 = _;
      return area;
    };
    area.defined = function (_) {
      if (!arguments.length) return defined;
      defined = _;
      return area;
    };
    area.interpolate = function (_) {
      if (!arguments.length) return interpolate;
      if (!d3_svg_lineInterpolators.has((_ += "")))
        _ = d3_svg_lineInterpolatorDefault;
      i0 = d3_svg_lineInterpolators.get((interpolate = _));
      i1 = i0.reverse || i0;
      L = /-closed$/.test(_) ? "M" : "L";
      return area;
    };
    area.tension = function (_) {
      if (!arguments.length) return tension;
      tension = _;
      return area;
    };
    return area;
  }
  d3_svg_lineStepBefore.reverse = d3_svg_lineStepAfter;
  d3_svg_lineStepAfter.reverse = d3_svg_lineStepBefore;
  d3.svg.area = function () {
    return d3_svg_area(Object);
  };
  d3.svg.area.radial = function () {
    var area = d3_svg_area(d3_svg_lineRadial);
    (area.radius = area.x), delete area.x;
    (area.innerRadius = area.x0), delete area.x0;
    (area.outerRadius = area.x1), delete area.x1;
    (area.angle = area.y), delete area.y;
    (area.startAngle = area.y0), delete area.y0;
    (area.endAngle = area.y1), delete area.y1;
    return area;
  };
  d3.svg.chord = function () {
    var source = d3_svg_chordSource,
      target = d3_svg_chordTarget,
      radius = d3_svg_chordRadius,
      startAngle = d3_svg_arcStartAngle,
      endAngle = d3_svg_arcEndAngle;
    function chord(d, i) {
      var s = subgroup(this, source, d, i),
        t = subgroup(this, target, d, i);
      return (
        "M" +
        s.p0 +
        arc(s.r, s.p1, s.a1 - s.a0) +
        (equals(s, t)
          ? curve(s.r, s.p1, s.r, s.p0)
          : curve(s.r, s.p1, t.r, t.p0) +
            arc(t.r, t.p1, t.a1 - t.a0) +
            curve(t.r, t.p1, s.r, s.p0)) +
        "Z"
      );
    }
    function subgroup(self, f, d, i) {
      var subgroup = f.call(self, d, i),
        r = radius.call(self, subgroup, i),
        a0 = startAngle.call(self, subgroup, i) + d3_svg_arcOffset,
        a1 = endAngle.call(self, subgroup, i) + d3_svg_arcOffset;
      return {
        r: r,
        a0: a0,
        a1: a1,
        p0: [r * Math.cos(a0), r * Math.sin(a0)],
        p1: [r * Math.cos(a1), r * Math.sin(a1)],
      };
    }
    function equals(a, b) {
      return a.a0 == b.a0 && a.a1 == b.a1;
    }
    function arc(r, p, a) {
      return "A" + r + "," + r + " 0 " + +(a > Math.PI) + ",1 " + p;
    }
    function curve(r0, p0, r1, p1) {
      return "Q 0,0 " + p1;
    }
    chord.radius = function (v) {
      if (!arguments.length) return radius;
      radius = d3_functor(v);
      return chord;
    };
    chord.source = function (v) {
      if (!arguments.length) return source;
      source = d3_functor(v);
      return chord;
    };
    chord.target = function (v) {
      if (!arguments.length) return target;
      target = d3_functor(v);
      return chord;
    };
    chord.startAngle = function (v) {
      if (!arguments.length) return startAngle;
      startAngle = d3_functor(v);
      return chord;
    };
    chord.endAngle = function (v) {
      if (!arguments.length) return endAngle;
      endAngle = d3_functor(v);
      return chord;
    };
    return chord;
  };
  function d3_svg_chordSource(d) {
    return d.source;
  }
  function d3_svg_chordTarget(d) {
    return d.target;
  }
  function d3_svg_chordRadius(d) {
    return d.radius;
  }
  function d3_svg_chordStartAngle(d) {
    return d.startAngle;
  }
  function d3_svg_chordEndAngle(d) {
    return d.endAngle;
  }
  d3.svg.diagonal = function () {
    var source = d3_svg_chordSource,
      target = d3_svg_chordTarget,
      projection = d3_svg_diagonalProjection;
    function diagonal(d, i) {
      var p0 = source.call(this, d, i),
        p3 = target.call(this, d, i),
        m = (p0.y + p3.y) / 2,
        p = [p0, { x: p0.x, y: m }, { x: p3.x, y: m }, p3];
      p = p.map(projection);
      return "M" + p[0] + "C" + p[1] + " " + p[2] + " " + p[3];
    }
    diagonal.source = function (x) {
      if (!arguments.length) return source;
      source = d3_functor(x);
      return diagonal;
    };
    diagonal.target = function (x) {
      if (!arguments.length) return target;
      target = d3_functor(x);
      return diagonal;
    };
    diagonal.projection = function (x) {
      if (!arguments.length) return projection;
      projection = x;
      return diagonal;
    };
    return diagonal;
  };
  function d3_svg_diagonalProjection(d) {
    return [d.x, d.y];
  }
  d3.svg.diagonal.radial = function () {
    var diagonal = d3.svg.diagonal(),
      projection = d3_svg_diagonalProjection,
      projection_ = diagonal.projection;
    diagonal.projection = function (x) {
      return arguments.length
        ? projection_(d3_svg_diagonalRadialProjection((projection = x)))
        : projection;
    };
    return diagonal;
  };
  function d3_svg_diagonalRadialProjection(projection) {
    return function () {
      var d = projection.apply(this, arguments),
        r = d[0],
        a = d[1] + d3_svg_arcOffset;
      return [r * Math.cos(a), r * Math.sin(a)];
    };
  }
  d3.svg.mouse = d3.mouse;
  d3.svg.touches = d3.touches;
  d3.svg.symbol = function () {
    var type = d3_svg_symbolType,
      size = d3_svg_symbolSize;
    function symbol(d, i) {
      return (d3_svg_symbols.get(type.call(this, d, i)) || d3_svg_symbolCircle)(
        size.call(this, d, i)
      );
    }
    symbol.type = function (x) {
      if (!arguments.length) return type;
      type = d3_functor(x);
      return symbol;
    };
    symbol.size = function (x) {
      if (!arguments.length) return size;
      size = d3_functor(x);
      return symbol;
    };
    return symbol;
  };
  function d3_svg_symbolSize() {
    return 64;
  }
  function d3_svg_symbolType() {
    return "circle";
  }
  function d3_svg_symbolCircle(size) {
    var r = Math.sqrt(size / Math.PI);
    return (
      "M0," +
      r +
      "A" +
      r +
      "," +
      r +
      " 0 1,1 0," +
      -r +
      "A" +
      r +
      "," +
      r +
      " 0 1,1 0," +
      r +
      "Z"
    );
  }
  var d3_svg_symbols = d3.map({
    circle: d3_svg_symbolCircle,
    cross: function (size) {
      var r = Math.sqrt(size / 5) / 2;
      return (
        "M" +
        -3 * r +
        "," +
        -r +
        "H" +
        -r +
        "V" +
        -3 * r +
        "H" +
        r +
        "V" +
        -r +
        "H" +
        3 * r +
        "V" +
        r +
        "H" +
        r +
        "V" +
        3 * r +
        "H" +
        -r +
        "V" +
        r +
        "H" +
        -3 * r +
        "Z"
      );
    },
    diamond: function (size) {
      var ry = Math.sqrt(size / (2 * d3_svg_symbolTan30)),
        rx = ry * d3_svg_symbolTan30;
      return (
        "M0," + -ry + "L" + rx + ",0" + " 0," + ry + " " + -rx + ",0" + "Z"
      );
    },
    square: function (size) {
      var r = Math.sqrt(size) / 2;
      return (
        "M" +
        -r +
        "," +
        -r +
        "L" +
        r +
        "," +
        -r +
        " " +
        r +
        "," +
        r +
        " " +
        -r +
        "," +
        r +
        "Z"
      );
    },
    "triangle-down": function (size) {
      var rx = Math.sqrt(size / d3_svg_symbolSqrt3),
        ry = (rx * d3_svg_symbolSqrt3) / 2;
      return "M0," + ry + "L" + rx + "," + -ry + " " + -rx + "," + -ry + "Z";
    },
    "triangle-up": function (size) {
      var rx = Math.sqrt(size / d3_svg_symbolSqrt3),
        ry = (rx * d3_svg_symbolSqrt3) / 2;
      return "M0," + -ry + "L" + rx + "," + ry + " " + -rx + "," + ry + "Z";
    },
  });
  d3.svg.symbolTypes = d3_svg_symbols.keys();
  var d3_svg_symbolSqrt3 = Math.sqrt(3),
    d3_svg_symbolTan30 = Math.tan((30 * Math.PI) / 180);
  d3.svg.axis = function () {
    var scale = d3.scale.linear(),
      orient = "bottom",
      tickMajorSize = 6,
      tickMinorSize = 6,
      tickEndSize = 6,
      tickPadding = 3,
      tickArguments_ = [10],
      tickValues = null,
      tickFormat_,
      tickSubdivide = 0;
    function axis(g) {
      g.each(function () {
        var g = d3.select(this);
        var ticks =
            tickValues == null
              ? scale.ticks
                ? scale.ticks.apply(scale, tickArguments_)
                : scale.domain()
              : tickValues,
          tickFormat =
            tickFormat_ == null
              ? scale.tickFormat
                ? scale.tickFormat.apply(scale, tickArguments_)
                : String
              : tickFormat_;
        var subticks = d3_svg_axisSubdivide(scale, ticks, tickSubdivide),
          subtick = g.selectAll(".minor").data(subticks, String),
          subtickEnter = subtick
            .enter()
            .insert("line", "g")
            .attr("class", "tick minor")
            .style("opacity", 1e-6),
          subtickExit = d3
            .transition(subtick.exit())
            .style("opacity", 1e-6)
            .remove(),
          subtickUpdate = d3.transition(subtick).style("opacity", 1);
        var tick = g.selectAll("g").data(ticks, String),
          tickEnter = tick.enter().insert("g", "path").style("opacity", 1e-6),
          tickExit = d3.transition(tick.exit()).style("opacity", 1e-6).remove(),
          tickUpdate = d3.transition(tick).style("opacity", 1),
          tickTransform;
        var range = d3_scaleRange(scale),
          path = g.selectAll(".domain").data([0]),
          pathEnter = path.enter().append("path").attr("class", "domain"),
          pathUpdate = d3.transition(path);
        var scale1 = scale.copy(),
          scale0 = this.__chart__ || scale1;
        this.__chart__ = scale1;
        tickEnter.append("line").attr("class", "tick");
        tickEnter.append("text");
        var lineEnter = tickEnter.select("line"),
          lineUpdate = tickUpdate.select("line"),
          text = tick.select("text").text(tickFormat),
          textEnter = tickEnter.select("text"),
          textUpdate = tickUpdate.select("text");
        switch (orient) {
          case "bottom":
            tickTransform = d3_svg_axisX;
            subtickEnter.attr("y2", tickMinorSize);
            subtickUpdate.attr("x2", 0).attr("y2", tickMinorSize);
            lineEnter.attr("y2", tickMajorSize);
            textEnter.attr("y", Math.max(tickMajorSize, 0) + tickPadding);
            lineUpdate.attr("x2", 0).attr("y2", tickMajorSize);
            textUpdate
              .attr("x", 0)
              .attr("y", Math.max(tickMajorSize, 0) + tickPadding);
            text.attr("dy", ".71em").attr("text-anchor", "middle");
            pathUpdate.attr(
              "d",
              "M" +
                range[0] +
                "," +
                tickEndSize +
                "V0H" +
                range[1] +
                "V" +
                tickEndSize
            );
            break;
          case "top":
            tickTransform = d3_svg_axisX;
            subtickEnter.attr("y2", -tickMinorSize);
            subtickUpdate.attr("x2", 0).attr("y2", -tickMinorSize);
            lineEnter.attr("y2", -tickMajorSize);
            textEnter.attr("y", -(Math.max(tickMajorSize, 0) + tickPadding));
            lineUpdate.attr("x2", 0).attr("y2", -tickMajorSize);
            textUpdate
              .attr("x", 0)
              .attr("y", -(Math.max(tickMajorSize, 0) + tickPadding));
            text.attr("dy", "0em").attr("text-anchor", "middle");
            pathUpdate.attr(
              "d",
              "M" +
                range[0] +
                "," +
                -tickEndSize +
                "V0H" +
                range[1] +
                "V" +
                -tickEndSize
            );
            break;
          case "left":
            tickTransform = d3_svg_axisY;
            subtickEnter.attr("x2", -tickMinorSize);
            subtickUpdate.attr("x2", -tickMinorSize).attr("y2", 0);
            lineEnter.attr("x2", -tickMajorSize);
            textEnter.attr("x", -(Math.max(tickMajorSize, 0) + tickPadding));
            lineUpdate.attr("x2", -tickMajorSize).attr("y2", 0);
            textUpdate
              .attr("x", -(Math.max(tickMajorSize, 0) + tickPadding))
              .attr("y", 0);
            text.attr("dy", ".32em").attr("text-anchor", "end");
            pathUpdate.attr(
              "d",
              "M" +
                -tickEndSize +
                "," +
                range[0] +
                "H0V" +
                range[1] +
                "H" +
                -tickEndSize
            );
            break;
          case "right":
            tickTransform = d3_svg_axisY;
            subtickEnter.attr("x2", tickMinorSize);
            subtickUpdate.attr("x2", tickMinorSize).attr("y2", 0);
            lineEnter.attr("x2", tickMajorSize);
            textEnter.attr("x", Math.max(tickMajorSize, 0) + tickPadding);
            lineUpdate.attr("x2", tickMajorSize).attr("y2", 0);
            textUpdate
              .attr("x", Math.max(tickMajorSize, 0) + tickPadding)
              .attr("y", 0);
            text.attr("dy", ".32em").attr("text-anchor", "start");
            pathUpdate.attr(
              "d",
              "M" +
                tickEndSize +
                "," +
                range[0] +
                "H0V" +
                range[1] +
                "H" +
                tickEndSize
            );
            break;
        }
        if (scale.ticks) {
          tickEnter.call(tickTransform, scale0);
          tickUpdate.call(tickTransform, scale1);
          tickExit.call(tickTransform, scale1);
          subtickEnter.call(tickTransform, scale0);
          subtickUpdate.call(tickTransform, scale1);
          subtickExit.call(tickTransform, scale1);
        } else {
          var dx = scale1.rangeBand() / 2,
            x = function (d) {
              return scale1(d) + dx;
            };
          tickEnter.call(tickTransform, x);
          tickUpdate.call(tickTransform, x);
        }
      });
    }
    axis.scale = function (x) {
      if (!arguments.length) return scale;
      scale = x;
      return axis;
    };
    axis.orient = function (x) {
      if (!arguments.length) return orient;
      orient = x;
      return axis;
    };
    axis.ticks = function () {
      if (!arguments.length) return tickArguments_;
      tickArguments_ = arguments;
      return axis;
    };
    axis.tickValues = function (x) {
      if (!arguments.length) return tickValues;
      tickValues = x;
      return axis;
    };
    axis.tickFormat = function (x) {
      if (!arguments.length) return tickFormat_;
      tickFormat_ = x;
      return axis;
    };
    axis.tickSize = function (x, y, z) {
      if (!arguments.length) return tickMajorSize;
      var n = arguments.length - 1;
      tickMajorSize = +x;
      tickMinorSize = n > 1 ? +y : tickMajorSize;
      tickEndSize = n > 0 ? +arguments[n] : tickMajorSize;
      return axis;
    };
    axis.tickPadding = function (x) {
      if (!arguments.length) return tickPadding;
      tickPadding = +x;
      return axis;
    };
    axis.tickSubdivide = function (x) {
      if (!arguments.length) return tickSubdivide;
      tickSubdivide = +x;
      return axis;
    };
    return axis;
  };
  function d3_svg_axisX(selection, x) {
    selection.attr("transform", function (d) {
      return "translate(" + x(d) + ",0)";
    });
  }
  function d3_svg_axisY(selection, y) {
    selection.attr("transform", function (d) {
      return "translate(0," + y(d) + ")";
    });
  }
  function d3_svg_axisSubdivide(scale, ticks, m) {
    subticks = [];
    if (m && ticks.length > 1) {
      var extent = d3_scaleExtent(scale.domain()),
        subticks,
        i = -1,
        n = ticks.length,
        d = (ticks[1] - ticks[0]) / ++m,
        j,
        v;
      while (++i < n)
        for (j = m; --j > 0; )
          if ((v = +ticks[i] - j * d) >= extent[0]) subticks.push(v);
      for (--i, j = 0; ++j < m && (v = +ticks[i] + j * d) < extent[1]; )
        subticks.push(v);
    }
    return subticks;
  }
  d3.svg.brush = function () {
    var event = d3_eventDispatch(brush, "brushstart", "brush", "brushend"),
      x = null,
      y = null,
      resizes = d3_svg_brushResizes[0],
      extent = [
        [0, 0],
        [0, 0],
      ],
      extentDomain;
    function brush(g) {
      g.each(function () {
        var g = d3.select(this),
          bg = g.selectAll(".background").data([0]),
          fg = g.selectAll(".extent").data([0]),
          tz = g.selectAll(".resize").data(resizes, String),
          e;
        g.style("pointer-events", "all")
          .on("mousedown.brush", brushstart)
          .on("touchstart.brush", brushstart);
        bg.enter()
          .append("rect")
          .attr("class", "background")
          .style("visibility", "hidden")
          .style("cursor", "crosshair");
        fg.enter()
          .append("rect")
          .attr("class", "extent")
          .style("cursor", "move");
        tz.enter()
          .append("g")
          .attr("class", function (d) {
            return "resize " + d;
          })
          .style("cursor", function (d) {
            return d3_svg_brushCursor[d];
          })
          .append("rect")
          .attr("x", function (d) {
            return /[ew]$/.test(d) ? -3 : null;
          })
          .attr("y", function (d) {
            return /^[ns]/.test(d) ? -3 : null;
          })
          .attr("width", 6)
          .attr("height", 6)
          .style("visibility", "hidden");
        tz.style("display", brush.empty() ? "none" : null);
        tz.exit().remove();
        if (x) {
          e = d3_scaleRange(x);
          bg.attr("x", e[0]).attr("width", e[1] - e[0]);
          redrawX(g);
        }
        if (y) {
          e = d3_scaleRange(y);
          bg.attr("y", e[0]).attr("height", e[1] - e[0]);
          redrawY(g);
        }
        redraw(g);
      });
    }
    function redraw(g) {
      g.selectAll(".resize").attr("transform", function (d) {
        return (
          "translate(" +
          extent[+/e$/.test(d)][0] +
          "," +
          extent[+/^s/.test(d)][1] +
          ")"
        );
      });
    }
    function redrawX(g) {
      g.select(".extent").attr("x", extent[0][0]);
      g.selectAll(".extent,.n>rect,.s>rect").attr(
        "width",
        extent[1][0] - extent[0][0]
      );
    }
    function redrawY(g) {
      g.select(".extent").attr("y", extent[0][1]);
      g.selectAll(".extent,.e>rect,.w>rect").attr(
        "height",
        extent[1][1] - extent[0][1]
      );
    }
    function brushstart() {
      var target = this,
        eventTarget = d3.select(d3.event.target),
        event_ = event.of(target, arguments),
        g = d3.select(target),
        resizing = eventTarget.datum(),
        resizingX = !/^(n|s)$/.test(resizing) && x,
        resizingY = !/^(e|w)$/.test(resizing) && y,
        dragging = eventTarget.classed("extent"),
        center,
        origin = mouse(),
        offset;
      var w = d3
        .select(window)
        .on("mousemove.brush", brushmove)
        .on("mouseup.brush", brushend)
        .on("touchmove.brush", brushmove)
        .on("touchend.brush", brushend)
        .on("keydown.brush", keydown)
        .on("keyup.brush", keyup);
      if (dragging) {
        origin[0] = extent[0][0] - origin[0];
        origin[1] = extent[0][1] - origin[1];
      } else if (resizing) {
        var ex = +/w$/.test(resizing),
          ey = +/^n/.test(resizing);
        offset = [extent[1 - ex][0] - origin[0], extent[1 - ey][1] - origin[1]];
        origin[0] = extent[ex][0];
        origin[1] = extent[ey][1];
      } else if (d3.event.altKey) center = origin.slice();
      g.style("pointer-events", "none")
        .selectAll(".resize")
        .style("display", null);
      d3.select("body").style("cursor", eventTarget.style("cursor"));
      event_({ type: "brushstart" });
      brushmove();
      d3_eventCancel();
      function mouse() {
        var touches = d3.event.changedTouches;
        return touches ? d3.touches(target, touches)[0] : d3.mouse(target);
      }
      function keydown() {
        if (d3.event.keyCode == 32) {
          if (!dragging) {
            center = null;
            origin[0] -= extent[1][0];
            origin[1] -= extent[1][1];
            dragging = 2;
          }
          d3_eventCancel();
        }
      }
      function keyup() {
        if (d3.event.keyCode == 32 && dragging == 2) {
          origin[0] += extent[1][0];
          origin[1] += extent[1][1];
          dragging = 0;
          d3_eventCancel();
        }
      }
      function brushmove() {
        var point = mouse(),
          moved = false;
        if (offset) {
          point[0] += offset[0];
          point[1] += offset[1];
        }
        if (!dragging)
          if (d3.event.altKey) {
            if (!center)
              center = [
                (extent[0][0] + extent[1][0]) / 2,
                (extent[0][1] + extent[1][1]) / 2,
              ];
            origin[0] = extent[+(point[0] < center[0])][0];
            origin[1] = extent[+(point[1] < center[1])][1];
          } else center = null;
        if (resizingX && move1(point, x, 0)) {
          redrawX(g);
          moved = true;
        }
        if (resizingY && move1(point, y, 1)) {
          redrawY(g);
          moved = true;
        }
        if (moved) {
          redraw(g);
          event_({ type: "brush", mode: dragging ? "move" : "resize" });
        }
      }
      function move1(point, scale, i) {
        var range = d3_scaleRange(scale),
          r0 = range[0],
          r1 = range[1],
          position = origin[i],
          size = extent[1][i] - extent[0][i],
          min,
          max;
        if (dragging) {
          r0 -= position;
          r1 -= size + position;
        }
        min = Math.max(r0, Math.min(r1, point[i]));
        if (dragging) max = (min += position) + size;
        else {
          if (center)
            position = Math.max(r0, Math.min(r1, 2 * center[i] - min));
          if (position < min) {
            max = min;
            min = position;
          } else max = position;
        }
        if (extent[0][i] !== min || extent[1][i] !== max) {
          extentDomain = null;
          extent[0][i] = min;
          extent[1][i] = max;
          return true;
        }
      }
      function brushend() {
        brushmove();
        g.style("pointer-events", "all")
          .selectAll(".resize")
          .style("display", brush.empty() ? "none" : null);
        d3.select("body").style("cursor", null);
        w.on("mousemove.brush", null)
          .on("mouseup.brush", null)
          .on("touchmove.brush", null)
          .on("touchend.brush", null)
          .on("keydown.brush", null)
          .on("keyup.brush", null);
        event_({ type: "brushend" });
        d3_eventCancel();
      }
    }
    brush.x = function (z) {
      if (!arguments.length) return x;
      x = z;
      resizes = d3_svg_brushResizes[(!x << 1) | !y];
      return brush;
    };
    brush.y = function (z) {
      if (!arguments.length) return y;
      y = z;
      resizes = d3_svg_brushResizes[(!x << 1) | !y];
      return brush;
    };
    brush.extent = function (z) {
      var x0, x1, y0, y1, t;
      if (!arguments.length) {
        z = extentDomain || extent;
        if (x) {
          (x0 = z[0][0]), (x1 = z[1][0]);
          if (!extentDomain) {
            (x0 = extent[0][0]), (x1 = extent[1][0]);
            if (x.invert) (x0 = x.invert(x0)), (x1 = x.invert(x1));
            if (x1 < x0) (t = x0), (x0 = x1), (x1 = t);
          }
        }
        if (y) {
          (y0 = z[0][1]), (y1 = z[1][1]);
          if (!extentDomain) {
            (y0 = extent[0][1]), (y1 = extent[1][1]);
            if (y.invert) (y0 = y.invert(y0)), (y1 = y.invert(y1));
            if (y1 < y0) (t = y0), (y0 = y1), (y1 = t);
          }
        }
        return x && y
          ? [
              [x0, y0],
              [x1, y1],
            ]
          : x
          ? [x0, x1]
          : y && [y0, y1];
      }
      extentDomain = [
        [0, 0],
        [0, 0],
      ];
      if (x) {
        (x0 = z[0]), (x1 = z[1]);
        if (y) (x0 = x0[0]), (x1 = x1[0]);
        (extentDomain[0][0] = x0), (extentDomain[1][0] = x1);
        if (x.invert) (x0 = x(x0)), (x1 = x(x1));
        if (x1 < x0) (t = x0), (x0 = x1), (x1 = t);
        (extent[0][0] = x0 | 0), (extent[1][0] = x1 | 0);
      }
      if (y) {
        (y0 = z[0]), (y1 = z[1]);
        if (x) (y0 = y0[1]), (y1 = y1[1]);
        (extentDomain[0][1] = y0), (extentDomain[1][1] = y1);
        if (y.invert) (y0 = y(y0)), (y1 = y(y1));
        if (y1 < y0) (t = y0), (y0 = y1), (y1 = t);
        (extent[0][1] = y0 | 0), (extent[1][1] = y1 | 0);
      }
      return brush;
    };
    brush.clear = function () {
      extentDomain = null;
      extent[0][0] = extent[0][1] = extent[1][0] = extent[1][1] = 0;
      return brush;
    };
    brush.empty = function () {
      return (
        (x && extent[0][0] === extent[1][0]) ||
        (y && extent[0][1] === extent[1][1])
      );
    };
    return d3.rebind(brush, event, "on");
  };
  var d3_svg_brushCursor = {
    n: "ns-resize",
    e: "ew-resize",
    s: "ns-resize",
    w: "ew-resize",
    nw: "nwse-resize",
    ne: "nesw-resize",
    se: "nwse-resize",
    sw: "nesw-resize",
  };
  var d3_svg_brushResizes = [
    ["n", "e", "s", "w", "nw", "ne", "se", "sw"],
    ["e", "w"],
    ["n", "s"],
    [],
  ];
  d3.behavior = {};
  d3.behavior.drag = function () {
    var event = d3_eventDispatch(drag, "drag", "dragstart", "dragend"),
      origin = null;
    function drag() {
      this.on("mousedown.drag", mousedown).on("touchstart.drag", mousedown);
    }
    function mousedown() {
      var target = this,
        event_ = event.of(target, arguments),
        eventTarget = d3.event.target,
        offset,
        origin_ = point(),
        moved = 0;
      var w = d3
        .select(window)
        .on("mousemove.drag", dragmove)
        .on("touchmove.drag", dragmove)
        .on("mouseup.drag", dragend, true)
        .on("touchend.drag", dragend, true);
      if (origin) {
        offset = origin.apply(target, arguments);
        offset = [offset.x - origin_[0], offset.y - origin_[1]];
      } else offset = [0, 0];
      d3_eventCancel();
      event_({ type: "dragstart" });
      function point() {
        var p = target.parentNode,
          t = d3.event.changedTouches;
        return t ? d3.touches(p, t)[0] : d3.mouse(p);
      }
      function dragmove() {
        if (!target.parentNode) return dragend();
        var p = point(),
          dx = p[0] - origin_[0],
          dy = p[1] - origin_[1];
        moved |= dx | dy;
        origin_ = p;
        d3_eventCancel();
        event_({
          type: "drag",
          x: p[0] + offset[0],
          y: p[1] + offset[1],
          dx: dx,
          dy: dy,
        });
      }
      function dragend() {
        event_({ type: "dragend" });
        if (moved) {
          d3_eventCancel();
          if (d3.event.target === eventTarget) w.on("click.drag", click, true);
        }
        w.on("mousemove.drag", null)
          .on("touchmove.drag", null)
          .on("mouseup.drag", null)
          .on("touchend.drag", null);
      }
      function click() {
        d3_eventCancel();
        w.on("click.drag", null);
      }
    }
    drag.origin = function (x) {
      if (!arguments.length) return origin;
      origin = x;
      return drag;
    };
    return d3.rebind(drag, event, "on");
  };
  d3.behavior.zoom = function () {
    var translate = [0, 0],
      translate0,
      scale = 1,
      scale0,
      scaleExtent = d3_behavior_zoomInfinity,
      event = d3_eventDispatch(zoom, "zoom"),
      x0,
      x1,
      y0,
      y1,
      touchtime;
    function zoom() {
      this.on("mousedown.zoom", mousedown)
        .on("mousewheel.zoom", mousewheel)
        .on("mousemove.zoom", mousemove)
        .on("DOMMouseScroll.zoom", mousewheel)
        .on("dblclick.zoom", dblclick)
        .on("touchstart.zoom", touchstart)
        .on("touchmove.zoom", touchmove)
        .on("touchend.zoom", touchstart);
    }
    zoom.translate = function (x) {
      if (!arguments.length) return translate;
      translate = x.map(Number);
      return zoom;
    };
    zoom.scale = function (x) {
      if (!arguments.length) return scale;
      scale = +x;
      return zoom;
    };
    zoom.scaleExtent = function (x) {
      if (!arguments.length) return scaleExtent;
      scaleExtent = x == null ? d3_behavior_zoomInfinity : x.map(Number);
      return zoom;
    };
    zoom.x = function (z) {
      if (!arguments.length) return x1;
      x1 = z;
      x0 = z.copy();
      return zoom;
    };
    zoom.y = function (z) {
      if (!arguments.length) return y1;
      y1 = z;
      y0 = z.copy();
      return zoom;
    };
    function location(p) {
      return [(p[0] - translate[0]) / scale, (p[1] - translate[1]) / scale];
    }
    function point(l) {
      return [l[0] * scale + translate[0], l[1] * scale + translate[1]];
    }
    function scaleTo(s) {
      scale = Math.max(scaleExtent[0], Math.min(scaleExtent[1], s));
    }
    function translateTo(p, l) {
      l = point(l);
      translate[0] += p[0] - l[0];
      translate[1] += p[1] - l[1];
    }
    function dispatch(event) {
      if (x1)
        x1.domain(
          x0
            .range()
            .map(function (x) {
              return (x - translate[0]) / scale;
            })
            .map(x0.invert)
        );
      if (y1)
        y1.domain(
          y0
            .range()
            .map(function (y) {
              return (y - translate[1]) / scale;
            })
            .map(y0.invert)
        );
      d3.event.preventDefault();
      event({ type: "zoom", scale: scale, translate: translate });
    }
    function mousedown() {
      var target = this,
        event_ = event.of(target, arguments),
        eventTarget = d3.event.target,
        moved = 0,
        w = d3
          .select(window)
          .on("mousemove.zoom", mousemove)
          .on("mouseup.zoom", mouseup),
        l = location(d3.mouse(target));
      window.focus();
      d3_eventCancel();
      function mousemove() {
        moved = 1;
        translateTo(d3.mouse(target), l);
        dispatch(event_);
      }
      function mouseup() {
        if (moved) d3_eventCancel();
        w.on("mousemove.zoom", null).on("mouseup.zoom", null);
        if (moved && d3.event.target === eventTarget)
          w.on("click.zoom", click, true);
      }
      function click() {
        d3_eventCancel();
        w.on("click.zoom", null);
      }
    }
    function mousewheel() {
      if (!translate0) translate0 = location(d3.mouse(this));
      scaleTo(Math.pow(2, d3_behavior_zoomDelta() * 0.002) * scale);
      translateTo(d3.mouse(this), translate0);
      dispatch(event.of(this, arguments));
    }
    function mousemove() {
      translate0 = null;
    }
    function dblclick() {
      var p = d3.mouse(this),
        l = location(p);
      scaleTo(d3.event.shiftKey ? scale / 2 : scale * 2);
      translateTo(p, l);
      dispatch(event.of(this, arguments));
    }
    function touchstart() {
      var touches = d3.touches(this),
        now = Date.now();
      scale0 = scale;
      translate0 = {};
      touches.forEach(function (t) {
        translate0[t.identifier] = location(t);
      });
      d3_eventCancel();
      if (touches.length === 1 && now - touchtime < 500) {
        var p = touches[0],
          l = location(touches[0]);
        scaleTo(scale * 2);
        translateTo(p, l);
        dispatch(event.of(this, arguments));
      }
      touchtime = now;
    }
    function touchmove() {
      var touches = d3.touches(this),
        p0 = touches[0],
        l0 = translate0[p0.identifier];
      if ((p1 = touches[1])) {
        var p1,
          l1 = translate0[p1.identifier];
        p0 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
        l0 = [(l0[0] + l1[0]) / 2, (l0[1] + l1[1]) / 2];
        scaleTo(d3.event.scale * scale0);
      }
      translateTo(p0, l0);
      dispatch(event.of(this, arguments));
    }
    return d3.rebind(zoom, event, "on");
  };
  var d3_behavior_zoomDiv,
    d3_behavior_zoomInfinity = [0, Infinity];
  function d3_behavior_zoomDelta() {
    if (!d3_behavior_zoomDiv)
      d3_behavior_zoomDiv = d3
        .select("body")
        .append("div")
        .style("visibility", "hidden")
        .style("top", 0)
        .style("height", 0)
        .style("width", 0)
        .style("overflow-y", "scroll")
        .append("div")
        .style("height", "2000px")
        .node().parentNode;
    var e = d3.event,
      delta;
    try {
      d3_behavior_zoomDiv.scrollTop = 1e3;
      d3_behavior_zoomDiv.dispatchEvent(e);
      delta = 1e3 - d3_behavior_zoomDiv.scrollTop;
    } catch (error) {
      delta = e.wheelDelta || -e.detail * 5;
    }
    return delta;
  }
  d3.layout = {};
  d3.layout.bundle = function () {
    return function (links) {
      var paths = [],
        i = -1,
        n = links.length;
      while (++i < n) paths.push(d3_layout_bundlePath(links[i]));
      return paths;
    };
  };
  function d3_layout_bundlePath(link) {
    var start = link.source,
      end = link.target,
      lca = d3_layout_bundleLeastCommonAncestor(start, end),
      points = [start];
    while (start !== lca) {
      start = start.parent;
      points.push(start);
    }
    var k = points.length;
    while (end !== lca) {
      points.splice(k, 0, end);
      end = end.parent;
    }
    return points;
  }
  function d3_layout_bundleAncestors(node) {
    var ancestors = [],
      parent = node.parent;
    while (parent != null) {
      ancestors.push(node);
      node = parent;
      parent = parent.parent;
    }
    ancestors.push(node);
    return ancestors;
  }
  function d3_layout_bundleLeastCommonAncestor(a, b) {
    if (a === b) return a;
    var aNodes = d3_layout_bundleAncestors(a),
      bNodes = d3_layout_bundleAncestors(b),
      aNode = aNodes.pop(),
      bNode = bNodes.pop(),
      sharedNode = null;
    while (aNode === bNode) {
      sharedNode = aNode;
      aNode = aNodes.pop();
      bNode = bNodes.pop();
    }
    return sharedNode;
  }
  d3.layout.chord = function () {
    var chord = {},
      chords,
      groups,
      matrix,
      n,
      padding = 0,
      sortGroups,
      sortSubgroups,
      sortChords;
    function relayout() {
      var subgroups = {},
        groupSums = [],
        groupIndex = d3.range(n),
        subgroupIndex = [],
        k,
        x,
        x0,
        i,
        j;
      chords = [];
      groups = [];
      (k = 0), (i = -1);
      while (++i < n) {
        (x = 0), (j = -1);
        while (++j < n) x += matrix[i][j];
        groupSums.push(x);
        subgroupIndex.push(d3.range(n));
        k += x;
      }
      if (sortGroups)
        groupIndex.sort(function (a, b) {
          return sortGroups(groupSums[a], groupSums[b]);
        });
      if (sortSubgroups)
        subgroupIndex.forEach(function (d, i) {
          d.sort(function (a, b) {
            return sortSubgroups(matrix[i][a], matrix[i][b]);
          });
        });
      k = (2 * Math.PI - padding * n) / k;
      (x = 0), (i = -1);
      while (++i < n) {
        (x0 = x), (j = -1);
        while (++j < n) {
          var di = groupIndex[i],
            dj = subgroupIndex[di][j],
            v = matrix[di][dj],
            a0 = x,
            a1 = (x += v * k);
          subgroups[di + "-" + dj] = {
            index: di,
            subindex: dj,
            startAngle: a0,
            endAngle: a1,
            value: v,
          };
        }
        groups[di] = {
          index: di,
          startAngle: x0,
          endAngle: x,
          value: (x - x0) / k,
        };
        x += padding;
      }
      i = -1;
      while (++i < n) {
        j = i - 1;
        while (++j < n) {
          var source = subgroups[i + "-" + j],
            target = subgroups[j + "-" + i];
          if (source.value || target.value)
            chords.push(
              source.value < target.value
                ? { source: target, target: source }
                : { source: source, target: target }
            );
        }
      }
      if (sortChords) resort();
    }
    function resort() {
      chords.sort(function (a, b) {
        return sortChords(
          (a.source.value + a.target.value) / 2,
          (b.source.value + b.target.value) / 2
        );
      });
    }
    chord.matrix = function (x) {
      if (!arguments.length) return matrix;
      n = (matrix = x) && matrix.length;
      chords = groups = null;
      return chord;
    };
    chord.padding = function (x) {
      if (!arguments.length) return padding;
      padding = x;
      chords = groups = null;
      return chord;
    };
    chord.sortGroups = function (x) {
      if (!arguments.length) return sortGroups;
      sortGroups = x;
      chords = groups = null;
      return chord;
    };
    chord.sortSubgroups = function (x) {
      if (!arguments.length) return sortSubgroups;
      sortSubgroups = x;
      chords = null;
      return chord;
    };
    chord.sortChords = function (x) {
      if (!arguments.length) return sortChords;
      sortChords = x;
      if (chords) resort();
      return chord;
    };
    chord.chords = function () {
      if (!chords) relayout();
      return chords;
    };
    chord.groups = function () {
      if (!groups) relayout();
      return groups;
    };
    return chord;
  };
  d3.layout.force = function () {
    var force = {},
      event = d3.dispatch("start", "tick", "end"),
      size = [1, 1],
      drag,
      alpha,
      friction = 0.9,
      linkDistance = d3_layout_forceLinkDistance,
      linkStrength = d3_layout_forceLinkStrength,
      charge = -30,
      gravity = 0.1,
      theta = 0.8,
      interval,
      nodes = [],
      links = [],
      distances,
      strengths,
      charges;
    function repulse(node) {
      return function (quad, x1, y1, x2, y2) {
        if (quad.point !== node) {
          var dx = quad.cx - node.x,
            dy = quad.cy - node.y,
            dn = 1 / Math.sqrt(dx * dx + dy * dy);
          if ((x2 - x1) * dn < theta) {
            var k = quad.charge * dn * dn;
            node.px -= dx * k;
            node.py -= dy * k;
            return true;
          }
          if (quad.point && isFinite(dn)) {
            var k = quad.pointCharge * dn * dn;
            node.px -= dx * k;
            node.py -= dy * k;
          }
        }
        return !quad.charge;
      };
    }
    force.tick = function () {
      if ((alpha *= 0.99) < 0.005) {
        event.end({ type: "end", alpha: (alpha = 0) });
        return true;
      }
      var n = nodes.length,
        m = links.length,
        q,
        i,
        o,
        s,
        t,
        l,
        k,
        x,
        y;
      for (i = 0; i < m; ++i) {
        o = links[i];
        s = o.source;
        t = o.target;
        x = t.x - s.x;
        y = t.y - s.y;
        if ((l = x * x + y * y)) {
          l = (alpha * strengths[i] * ((l = Math.sqrt(l)) - distances[i])) / l;
          x *= l;
          y *= l;
          t.x -= x * (k = s.weight / (t.weight + s.weight));
          t.y -= y * k;
          s.x += x * (k = 1 - k);
          s.y += y * k;
        }
      }
      if ((k = alpha * gravity)) {
        x = size[0] / 2;
        y = size[1] / 2;
        i = -1;
        if (k)
          while (++i < n) {
            o = nodes[i];
            o.x += (x - o.x) * k;
            o.y += (y - o.y) * k;
          }
      }
      if (charge) {
        d3_layout_forceAccumulate(
          (q = d3.geom.quadtree(nodes)),
          alpha,
          charges
        );
        i = -1;
        while (++i < n) if (!(o = nodes[i]).fixed) q.visit(repulse(o));
      }
      i = -1;
      while (++i < n) {
        o = nodes[i];
        if (o.fixed) {
          o.x = o.px;
          o.y = o.py;
        } else {
          o.x -= (o.px - (o.px = o.x)) * friction;
          o.y -= (o.py - (o.py = o.y)) * friction;
        }
      }
      event.tick({ type: "tick", alpha: alpha });
    };
    force.nodes = function (x) {
      if (!arguments.length) return nodes;
      nodes = x;
      return force;
    };
    force.links = function (x) {
      if (!arguments.length) return links;
      links = x;
      return force;
    };
    force.size = function (x) {
      if (!arguments.length) return size;
      size = x;
      return force;
    };
    force.linkDistance = function (x) {
      if (!arguments.length) return linkDistance;
      linkDistance = d3_functor(x);
      return force;
    };
    force.distance = force.linkDistance;
    force.linkStrength = function (x) {
      if (!arguments.length) return linkStrength;
      linkStrength = d3_functor(x);
      return force;
    };
    force.friction = function (x) {
      if (!arguments.length) return friction;
      friction = x;
      return force;
    };
    force.charge = function (x) {
      if (!arguments.length) return charge;
      charge = typeof x === "function" ? x : +x;
      return force;
    };
    force.gravity = function (x) {
      if (!arguments.length) return gravity;
      gravity = x;
      return force;
    };
    force.theta = function (x) {
      if (!arguments.length) return theta;
      theta = x;
      return force;
    };
    force.alpha = function (x) {
      if (!arguments.length) return alpha;
      if (alpha)
        if (x > 0) alpha = x;
        else alpha = 0;
      else if (x > 0) {
        event.start({ type: "start", alpha: (alpha = x) });
        d3.timer(force.tick);
      }
      return force;
    };
    force.start = function () {
      var i,
        j,
        n = nodes.length,
        m = links.length,
        w = size[0],
        h = size[1],
        neighbors,
        o;
      for (i = 0; i < n; ++i) {
        (o = nodes[i]).index = i;
        o.weight = 0;
      }
      distances = [];
      strengths = [];
      for (i = 0; i < m; ++i) {
        o = links[i];
        if (typeof o.source == "number") o.source = nodes[o.source];
        if (typeof o.target == "number") o.target = nodes[o.target];
        distances[i] = linkDistance.call(this, o, i);
        strengths[i] = linkStrength.call(this, o, i);
        ++o.source.weight;
        ++o.target.weight;
      }
      for (i = 0; i < n; ++i) {
        o = nodes[i];
        if (isNaN(o.x)) o.x = position("x", w);
        if (isNaN(o.y)) o.y = position("y", h);
        if (isNaN(o.px)) o.px = o.x;
        if (isNaN(o.py)) o.py = o.y;
      }
      charges = [];
      if (typeof charge === "function")
        for (i = 0; i < n; ++i) charges[i] = +charge.call(this, nodes[i], i);
      else for (i = 0; i < n; ++i) charges[i] = charge;
      function position(dimension, size) {
        var neighbors = neighbor(i),
          j = -1,
          m = neighbors.length,
          x;
        while (++j < m) if (!isNaN((x = neighbors[j][dimension]))) return x;
        return Math.random() * size;
      }
      function neighbor() {
        if (!neighbors) {
          neighbors = [];
          for (j = 0; j < n; ++j) neighbors[j] = [];
          for (j = 0; j < m; ++j) {
            var o = links[j];
            neighbors[o.source.index].push(o.target);
            neighbors[o.target.index].push(o.source);
          }
        }
        return neighbors[i];
      }
      return force.resume();
    };
    force.resume = function () {
      return force.alpha(0.1);
    };
    force.stop = function () {
      return force.alpha(0);
    };
    force.drag = function () {
      if (!drag)
        drag = d3.behavior
          .drag()
          .origin(d3_identity)
          .on("dragstart", dragstart)
          .on("drag", d3_layout_forceDrag)
          .on("dragend", d3_layout_forceDragEnd);
      this.on("mouseover.force", d3_layout_forceDragOver)
        .on("mouseout.force", d3_layout_forceDragOut)
        .call(drag);
    };
    function dragstart(d) {
      d3_layout_forceDragOver((d3_layout_forceDragNode = d));
      d3_layout_forceDragForce = force;
    }
    return d3.rebind(force, event, "on");
  };
  var d3_layout_forceDragForce, d3_layout_forceDragNode;
  function d3_layout_forceDragOver(d) {
    d.fixed |= 2;
  }
  function d3_layout_forceDragOut(d) {
    if (d !== d3_layout_forceDragNode) d.fixed &= 1;
  }
  function d3_layout_forceDragEnd() {
    d3_layout_forceDragNode.fixed &= 1;
    d3_layout_forceDragForce = d3_layout_forceDragNode = null;
  }
  function d3_layout_forceDrag() {
    d3_layout_forceDragNode.px = d3.event.x;
    d3_layout_forceDragNode.py = d3.event.y;
    d3_layout_forceDragForce.resume();
  }
  function d3_layout_forceAccumulate(quad, alpha, charges) {
    var cx = 0,
      cy = 0;
    quad.charge = 0;
    if (!quad.leaf) {
      var nodes = quad.nodes,
        n = nodes.length,
        i = -1,
        c;
      while (++i < n) {
        c = nodes[i];
        if (c == null) continue;
        d3_layout_forceAccumulate(c, alpha, charges);
        quad.charge += c.charge;
        cx += c.charge * c.cx;
        cy += c.charge * c.cy;
      }
    }
    if (quad.point) {
      if (!quad.leaf) {
        quad.point.x += Math.random() - 0.5;
        quad.point.y += Math.random() - 0.5;
      }
      var k = alpha * charges[quad.point.index];
      quad.charge += quad.pointCharge = k;
      cx += k * quad.point.x;
      cy += k * quad.point.y;
    }
    quad.cx = cx / quad.charge;
    quad.cy = cy / quad.charge;
  }
  function d3_layout_forceLinkDistance(link) {
    return 20;
  }
  function d3_layout_forceLinkStrength(link) {
    return 1;
  }
  d3.layout.partition = function () {
    var hierarchy = d3.layout.hierarchy(),
      size = [1, 1];
    function position(node, x, dx, dy) {
      var children = node.children;
      node.x = x;
      node.y = node.depth * dy;
      node.dx = dx;
      node.dy = dy;
      if (children && (n = children.length)) {
        var i = -1,
          n,
          c,
          d;
        dx = node.value ? dx / node.value : 0;
        while (++i < n) {
          position((c = children[i]), x, (d = c.value * dx), dy);
          x += d;
        }
      }
    }
    function depth(node) {
      var children = node.children,
        d = 0;
      if (children && (n = children.length)) {
        var i = -1,
          n;
        while (++i < n) d = Math.max(d, depth(children[i]));
      }
      return 1 + d;
    }
    function partition(d, i) {
      var nodes = hierarchy.call(this, d, i);
      position(nodes[0], 0, size[0], size[1] / depth(nodes[0]));
      return nodes;
    }
    partition.size = function (x) {
      if (!arguments.length) return size;
      size = x;
      return partition;
    };
    return d3_layout_hierarchyRebind(partition, hierarchy);
  };
  d3.layout.pie = function () {
    var value = Number,
      sort = d3_layout_pieSortByValue,
      startAngle = 0,
      endAngle = 2 * Math.PI;
    function pie(data, i) {
      var values = data.map(function (d, i) {
        return +value.call(pie, d, i);
      });
      var a = +(typeof startAngle === "function"
        ? startAngle.apply(this, arguments)
        : startAngle);
      var k =
        ((typeof endAngle === "function"
          ? endAngle.apply(this, arguments)
          : endAngle) -
          startAngle) /
        d3.sum(values);
      var index = d3.range(data.length);
      if (sort != null)
        index.sort(
          sort === d3_layout_pieSortByValue
            ? function (i, j) {
                return values[j] - values[i];
              }
            : function (i, j) {
                return sort(data[i], data[j]);
              }
        );
      var arcs = [];
      index.forEach(function (i) {
        var d;
        arcs[i] = {
          data: data[i],
          value: (d = values[i]),
          startAngle: a,
          endAngle: (a += d * k),
        };
      });
      return arcs;
    }
    pie.value = function (x) {
      if (!arguments.length) return value;
      value = x;
      return pie;
    };
    pie.sort = function (x) {
      if (!arguments.length) return sort;
      sort = x;
      return pie;
    };
    pie.startAngle = function (x) {
      if (!arguments.length) return startAngle;
      startAngle = x;
      return pie;
    };
    pie.endAngle = function (x) {
      if (!arguments.length) return endAngle;
      endAngle = x;
      return pie;
    };
    return pie;
  };
  var d3_layout_pieSortByValue = {};
  d3.layout.stack = function () {
    var values = d3_identity,
      order = d3_layout_stackOrderDefault,
      offset = d3_layout_stackOffsetZero,
      out = d3_layout_stackOut,
      x = d3_layout_stackX,
      y = d3_layout_stackY;
    function stack(data, index) {
      var series = data.map(function (d, i) {
        return values.call(stack, d, i);
      });
      var points = series.map(function (d, i) {
        return d.map(function (v, i) {
          return [x.call(stack, v, i), y.call(stack, v, i)];
        });
      });
      var orders = order.call(stack, points, index);
      series = d3.permute(series, orders);
      points = d3.permute(points, orders);
      var offsets = offset.call(stack, points, index);
      var n = series.length,
        m = series[0].length,
        i,
        j,
        o;
      for (j = 0; j < m; ++j) {
        out.call(stack, series[0][j], (o = offsets[j]), points[0][j][1]);
        for (i = 1; i < n; ++i)
          out.call(
            stack,
            series[i][j],
            (o += points[i - 1][j][1]),
            points[i][j][1]
          );
      }
      return data;
    }
    stack.values = function (x) {
      if (!arguments.length) return values;
      values = x;
      return stack;
    };
    stack.order = function (x) {
      if (!arguments.length) return order;
      order =
        typeof x === "function"
          ? x
          : d3_layout_stackOrders.get(x) || d3_layout_stackOrderDefault;
      return stack;
    };
    stack.offset = function (x) {
      if (!arguments.length) return offset;
      offset =
        typeof x === "function"
          ? x
          : d3_layout_stackOffsets.get(x) || d3_layout_stackOffsetZero;
      return stack;
    };
    stack.x = function (z) {
      if (!arguments.length) return x;
      x = z;
      return stack;
    };
    stack.y = function (z) {
      if (!arguments.length) return y;
      y = z;
      return stack;
    };
    stack.out = function (z) {
      if (!arguments.length) return out;
      out = z;
      return stack;
    };
    return stack;
  };
  function d3_layout_stackX(d) {
    return d.x;
  }
  function d3_layout_stackY(d) {
    return d.y;
  }
  function d3_layout_stackOut(d, y0, y) {
    d.y0 = y0;
    d.y = y;
  }
  var d3_layout_stackOrders = d3.map({
    "inside-out": function (data) {
      var n = data.length,
        i,
        j,
        max = data.map(d3_layout_stackMaxIndex),
        sums = data.map(d3_layout_stackReduceSum),
        index = d3.range(n).sort(function (a, b) {
          return max[a] - max[b];
        }),
        top = 0,
        bottom = 0,
        tops = [],
        bottoms = [];
      for (i = 0; i < n; ++i) {
        j = index[i];
        if (top < bottom) {
          top += sums[j];
          tops.push(j);
        } else {
          bottom += sums[j];
          bottoms.push(j);
        }
      }
      return bottoms.reverse().concat(tops);
    },
    reverse: function (data) {
      return d3.range(data.length).reverse();
    },
    default: d3_layout_stackOrderDefault,
  });
  var d3_layout_stackOffsets = d3.map({
    silhouette: function (data) {
      var n = data.length,
        m = data[0].length,
        sums = [],
        max = 0,
        i,
        j,
        o,
        y0 = [];
      for (j = 0; j < m; ++j) {
        for (i = 0, o = 0; i < n; i++) o += data[i][j][1];
        if (o > max) max = o;
        sums.push(o);
      }
      for (j = 0; j < m; ++j) y0[j] = (max - sums[j]) / 2;
      return y0;
    },
    wiggle: function (data) {
      var n = data.length,
        x = data[0],
        m = x.length,
        max = 0,
        i,
        j,
        k,
        s1,
        s2,
        s3,
        dx,
        o,
        o0,
        y0 = [];
      y0[0] = o = o0 = 0;
      for (j = 1; j < m; ++j) {
        for (i = 0, s1 = 0; i < n; ++i) s1 += data[i][j][1];
        for (i = 0, s2 = 0, dx = x[j][0] - x[j - 1][0]; i < n; ++i) {
          for (
            k = 0, s3 = (data[i][j][1] - data[i][j - 1][1]) / (2 * dx);
            k < i;
            ++k
          )
            s3 += (data[k][j][1] - data[k][j - 1][1]) / dx;
          s2 += s3 * data[i][j][1];
        }
        y0[j] = o -= s1 ? (s2 / s1) * dx : 0;
        if (o < o0) o0 = o;
      }
      for (j = 0; j < m; ++j) y0[j] -= o0;
      return y0;
    },
    expand: function (data) {
      var n = data.length,
        m = data[0].length,
        k = 1 / n,
        i,
        j,
        o,
        y0 = [];
      for (j = 0; j < m; ++j) {
        for (i = 0, o = 0; i < n; i++) o += data[i][j][1];
        if (o) for (i = 0; i < n; i++) data[i][j][1] /= o;
        else for (i = 0; i < n; i++) data[i][j][1] = k;
      }
      for (j = 0; j < m; ++j) y0[j] = 0;
      return y0;
    },
    zero: d3_layout_stackOffsetZero,
  });
  function d3_layout_stackOrderDefault(data) {
    return d3.range(data.length);
  }
  function d3_layout_stackOffsetZero(data) {
    var j = -1,
      m = data[0].length,
      y0 = [];
    while (++j < m) y0[j] = 0;
    return y0;
  }
  function d3_layout_stackMaxIndex(array) {
    var i = 1,
      j = 0,
      v = array[0][1],
      k,
      n = array.length;
    for (; i < n; ++i)
      if ((k = array[i][1]) > v) {
        j = i;
        v = k;
      }
    return j;
  }
  function d3_layout_stackReduceSum(d) {
    return d.reduce(d3_layout_stackSum, 0);
  }
  function d3_layout_stackSum(p, d) {
    return p + d[1];
  }
  d3.layout.histogram = function () {
    var frequency = true,
      valuer = Number,
      ranger = d3_layout_histogramRange,
      binner = d3_layout_histogramBinSturges;
    function histogram(data, i) {
      var bins = [],
        values = data.map(valuer, this),
        range = ranger.call(this, values, i),
        thresholds = binner.call(this, range, values, i),
        bin,
        i = -1,
        n = values.length,
        m = thresholds.length - 1,
        k = frequency ? 1 : 1 / n,
        x;
      while (++i < m) {
        bin = bins[i] = [];
        bin.dx = thresholds[i + 1] - (bin.x = thresholds[i]);
        bin.y = 0;
      }
      if (m > 0) {
        i = -1;
        while (++i < n) {
          x = values[i];
          if (x >= range[0] && x <= range[1]) {
            bin = bins[d3.bisect(thresholds, x, 1, m) - 1];
            bin.y += k;
            bin.push(data[i]);
          }
        }
      }
      return bins;
    }
    histogram.value = function (x) {
      if (!arguments.length) return valuer;
      valuer = x;
      return histogram;
    };
    histogram.range = function (x) {
      if (!arguments.length) return ranger;
      ranger = d3_functor(x);
      return histogram;
    };
    histogram.bins = function (x) {
      if (!arguments.length) return binner;
      binner =
        typeof x === "number"
          ? function (range) {
              return d3_layout_histogramBinFixed(range, x);
            }
          : d3_functor(x);
      return histogram;
    };
    histogram.frequency = function (x) {
      if (!arguments.length) return frequency;
      frequency = !!x;
      return histogram;
    };
    return histogram;
  };
  function d3_layout_histogramBinSturges(range, values) {
    return d3_layout_histogramBinFixed(
      range,
      Math.ceil(Math.log(values.length) / Math.LN2 + 1)
    );
  }
  function d3_layout_histogramBinFixed(range, n) {
    var x = -1,
      b = +range[0],
      m = (range[1] - b) / n,
      f = [];
    while (++x <= n) f[x] = m * x + b;
    return f;
  }
  function d3_layout_histogramRange(values) {
    return [d3.min(values), d3.max(values)];
  }
  d3.layout.hierarchy = function () {
    var sort = d3_layout_hierarchySort,
      children = d3_layout_hierarchyChildren,
      value = d3_layout_hierarchyValue;
    function recurse(data, depth, nodes) {
      var childs = children.call(hierarchy, data, depth),
        node = d3_layout_hierarchyInline ? data : { data: data };
      node.depth = depth;
      nodes.push(node);
      if (childs && (n = childs.length)) {
        var i = -1,
          n,
          c = (node.children = []),
          v = 0,
          j = depth + 1,
          d;
        while (++i < n) {
          d = recurse(childs[i], j, nodes);
          d.parent = node;
          c.push(d);
          v += d.value;
        }
        if (sort) c.sort(sort);
        if (value) node.value = v;
      } else if (value) node.value = +value.call(hierarchy, data, depth) || 0;
      return node;
    }
    function revalue(node, depth) {
      var children = node.children,
        v = 0;
      if (children && (n = children.length)) {
        var i = -1,
          n,
          j = depth + 1;
        while (++i < n) v += revalue(children[i], j);
      } else if (value)
        v =
          +value.call(
            hierarchy,
            d3_layout_hierarchyInline ? node : node.data,
            depth
          ) || 0;
      if (value) node.value = v;
      return v;
    }
    function hierarchy(d) {
      var nodes = [];
      recurse(d, 0, nodes);
      return nodes;
    }
    hierarchy.sort = function (x) {
      if (!arguments.length) return sort;
      sort = x;
      return hierarchy;
    };
    hierarchy.children = function (x) {
      if (!arguments.length) return children;
      children = x;
      return hierarchy;
    };
    hierarchy.value = function (x) {
      if (!arguments.length) return value;
      value = x;
      return hierarchy;
    };
    hierarchy.revalue = function (root) {
      revalue(root, 0);
      return root;
    };
    return hierarchy;
  };
  function d3_layout_hierarchyRebind(object, hierarchy) {
    d3.rebind(object, hierarchy, "sort", "children", "value");
    object.links = d3_layout_hierarchyLinks;
    object.nodes = function (d) {
      d3_layout_hierarchyInline = true;
      return (object.nodes = object)(d);
    };
    return object;
  }
  function d3_layout_hierarchyChildren(d) {
    return d.children;
  }
  function d3_layout_hierarchyValue(d) {
    return d.value;
  }
  function d3_layout_hierarchySort(a, b) {
    return b.value - a.value;
  }
  function d3_layout_hierarchyLinks(nodes) {
    return d3.merge(
      nodes.map(function (parent) {
        return (parent.children || []).map(function (child) {
          return { source: parent, target: child };
        });
      })
    );
  }
  var d3_layout_hierarchyInline = false;
  d3.layout.pack = function () {
    var hierarchy = d3.layout.hierarchy().sort(d3_layout_packSort),
      size = [1, 1];
    function pack(d, i) {
      var nodes = hierarchy.call(this, d, i),
        root = nodes[0];
      root.x = 0;
      root.y = 0;
      d3_layout_packTree(root);
      var w = size[0],
        h = size[1],
        k = 1 / Math.max((2 * root.r) / w, (2 * root.r) / h);
      d3_layout_packTransform(root, w / 2, h / 2, k);
      return nodes;
    }
    pack.size = function (x) {
      if (!arguments.length) return size;
      size = x;
      return pack;
    };
    return d3_layout_hierarchyRebind(pack, hierarchy);
  };
  function d3_layout_packSort(a, b) {
    return a.value - b.value;
  }
  function d3_layout_packInsert(a, b) {
    var c = a._pack_next;
    a._pack_next = b;
    b._pack_prev = a;
    b._pack_next = c;
    c._pack_prev = b;
  }
  function d3_layout_packSplice(a, b) {
    a._pack_next = b;
    b._pack_prev = a;
  }
  function d3_layout_packIntersects(a, b) {
    var dx = b.x - a.x,
      dy = b.y - a.y,
      dr = a.r + b.r;
    return dr * dr - dx * dx - dy * dy > 0.001;
  }
  function d3_layout_packCircle(nodes) {
    var xMin = Infinity,
      xMax = -Infinity,
      yMin = Infinity,
      yMax = -Infinity,
      n = nodes.length,
      a,
      b,
      c,
      j,
      k;
    function bound(node) {
      xMin = Math.min(node.x - node.r, xMin);
      xMax = Math.max(node.x + node.r, xMax);
      yMin = Math.min(node.y - node.r, yMin);
      yMax = Math.max(node.y + node.r, yMax);
    }
    nodes.forEach(d3_layout_packLink);
    a = nodes[0];
    a.x = -a.r;
    a.y = 0;
    bound(a);
    if (n > 1) {
      b = nodes[1];
      b.x = b.r;
      b.y = 0;
      bound(b);
      if (n > 2) {
        c = nodes[2];
        d3_layout_packPlace(a, b, c);
        bound(c);
        d3_layout_packInsert(a, c);
        a._pack_prev = c;
        d3_layout_packInsert(c, b);
        b = a._pack_next;
        for (var i = 3; i < n; i++) {
          d3_layout_packPlace(a, b, (c = nodes[i]));
          var isect = 0,
            s1 = 1,
            s2 = 1;
          for (j = b._pack_next; j !== b; j = j._pack_next, s1++)
            if (d3_layout_packIntersects(j, c)) {
              isect = 1;
              break;
            }
          if (isect == 1)
            for (k = a._pack_prev; k !== j._pack_prev; k = k._pack_prev, s2++)
              if (d3_layout_packIntersects(k, c)) break;
          if (isect) {
            if (s1 < s2 || (s1 == s2 && b.r < a.r))
              d3_layout_packSplice(a, (b = j));
            else d3_layout_packSplice((a = k), b);
            i--;
          } else {
            d3_layout_packInsert(a, c);
            b = c;
            bound(c);
          }
        }
      }
    }
    var cx = (xMin + xMax) / 2,
      cy = (yMin + yMax) / 2,
      cr = 0;
    for (var i = 0; i < n; i++) {
      var node = nodes[i];
      node.x -= cx;
      node.y -= cy;
      cr = Math.max(cr, node.r + Math.sqrt(node.x * node.x + node.y * node.y));
    }
    nodes.forEach(d3_layout_packUnlink);
    return cr;
  }
  function d3_layout_packLink(node) {
    node._pack_next = node._pack_prev = node;
  }
  function d3_layout_packUnlink(node) {
    delete node._pack_next;
    delete node._pack_prev;
  }
  function d3_layout_packTree(node) {
    var children = node.children;
    if (children && children.length) {
      children.forEach(d3_layout_packTree);
      node.r = d3_layout_packCircle(children);
    } else node.r = Math.sqrt(node.value);
  }
  function d3_layout_packTransform(node, x, y, k) {
    var children = node.children;
    node.x = x += k * node.x;
    node.y = y += k * node.y;
    node.r *= k;
    if (children) {
      var i = -1,
        n = children.length;
      while (++i < n) d3_layout_packTransform(children[i], x, y, k);
    }
  }
  function d3_layout_packPlace(a, b, c) {
    var db = a.r + c.r,
      dx = b.x - a.x,
      dy = b.y - a.y;
    if (db && (dx || dy)) {
      var da = b.r + c.r,
        dc = Math.sqrt(dx * dx + dy * dy),
        cos = Math.max(
          -1,
          Math.min(1, (db * db + dc * dc - da * da) / (2 * db * dc))
        ),
        theta = Math.acos(cos),
        x = cos * (db /= dc),
        y = Math.sin(theta) * db;
      c.x = a.x + x * dx + y * dy;
      c.y = a.y + x * dy - y * dx;
    } else {
      c.x = a.x + db;
      c.y = a.y;
    }
  }
  d3.layout.cluster = function () {
    var hierarchy = d3.layout.hierarchy().sort(null).value(null),
      separation = d3_layout_treeSeparation,
      size = [1, 1];
    function cluster(d, i) {
      var nodes = hierarchy.call(this, d, i),
        root = nodes[0],
        previousNode,
        x = 0,
        kx,
        ky;
      d3_layout_treeVisitAfter(root, function (node) {
        var children = node.children;
        if (children && children.length) {
          node.x = d3_layout_clusterX(children);
          node.y = d3_layout_clusterY(children);
        } else {
          node.x = previousNode ? (x += separation(node, previousNode)) : 0;
          node.y = 0;
          previousNode = node;
        }
      });
      var left = d3_layout_clusterLeft(root),
        right = d3_layout_clusterRight(root),
        x0 = left.x - separation(left, right) / 2,
        x1 = right.x + separation(right, left) / 2;
      d3_layout_treeVisitAfter(root, function (node) {
        node.x = ((node.x - x0) / (x1 - x0)) * size[0];
        node.y = (1 - (root.y ? node.y / root.y : 1)) * size[1];
      });
      return nodes;
    }
    cluster.separation = function (x) {
      if (!arguments.length) return separation;
      separation = x;
      return cluster;
    };
    cluster.size = function (x) {
      if (!arguments.length) return size;
      size = x;
      return cluster;
    };
    return d3_layout_hierarchyRebind(cluster, hierarchy);
  };
  function d3_layout_clusterY(children) {
    return (
      1 +
      d3.max(children, function (child) {
        return child.y;
      })
    );
  }
  function d3_layout_clusterX(children) {
    return (
      children.reduce(function (x, child) {
        return x + child.x;
      }, 0) / children.length
    );
  }
  function d3_layout_clusterLeft(node) {
    var children = node.children;
    return children && children.length
      ? d3_layout_clusterLeft(children[0])
      : node;
  }
  function d3_layout_clusterRight(node) {
    var children = node.children,
      n;
    return children && (n = children.length)
      ? d3_layout_clusterRight(children[n - 1])
      : node;
  }
  d3.layout.tree = function () {
    var hierarchy = d3.layout.hierarchy().sort(null).value(null),
      separation = d3_layout_treeSeparation,
      size = [1, 1];
    function tree(d, i) {
      var nodes = hierarchy.call(this, d, i),
        root = nodes[0];
      function firstWalk(node, previousSibling) {
        var children = node.children,
          layout = node._tree;
        if (children && (n = children.length)) {
          var n,
            firstChild = children[0],
            previousChild,
            ancestor = firstChild,
            child,
            i = -1;
          while (++i < n) {
            child = children[i];
            firstWalk(child, previousChild);
            ancestor = apportion(child, previousChild, ancestor);
            previousChild = child;
          }
          d3_layout_treeShift(node);
          var midpoint = 0.5 * (firstChild._tree.prelim + child._tree.prelim);
          if (previousSibling) {
            layout.prelim =
              previousSibling._tree.prelim + separation(node, previousSibling);
            layout.mod = layout.prelim - midpoint;
          } else layout.prelim = midpoint;
        } else if (previousSibling)
          layout.prelim =
            previousSibling._tree.prelim + separation(node, previousSibling);
      }
      function secondWalk(node, x) {
        node.x = node._tree.prelim + x;
        var children = node.children;
        if (children && (n = children.length)) {
          var i = -1,
            n;
          x += node._tree.mod;
          while (++i < n) secondWalk(children[i], x);
        }
      }
      function apportion(node, previousSibling, ancestor) {
        if (previousSibling) {
          var vip = node,
            vop = node,
            vim = previousSibling,
            vom = node.parent.children[0],
            sip = vip._tree.mod,
            sop = vop._tree.mod,
            sim = vim._tree.mod,
            som = vom._tree.mod,
            shift;
          while (
            ((vim = d3_layout_treeRight(vim)),
            (vip = d3_layout_treeLeft(vip)),
            vim && vip)
          ) {
            vom = d3_layout_treeLeft(vom);
            vop = d3_layout_treeRight(vop);
            vop._tree.ancestor = node;
            shift =
              vim._tree.prelim +
              sim -
              vip._tree.prelim -
              sip +
              separation(vim, vip);
            if (shift > 0) {
              d3_layout_treeMove(
                d3_layout_treeAncestor(vim, node, ancestor),
                node,
                shift
              );
              sip += shift;
              sop += shift;
            }
            sim += vim._tree.mod;
            sip += vip._tree.mod;
            som += vom._tree.mod;
            sop += vop._tree.mod;
          }
          if (vim && !d3_layout_treeRight(vop)) {
            vop._tree.thread = vim;
            vop._tree.mod += sim - sop;
          }
          if (vip && !d3_layout_treeLeft(vom)) {
            vom._tree.thread = vip;
            vom._tree.mod += sip - som;
            ancestor = node;
          }
        }
        return ancestor;
      }
      d3_layout_treeVisitAfter(root, function (node, previousSibling) {
        node._tree = {
          ancestor: node,
          prelim: 0,
          mod: 0,
          change: 0,
          shift: 0,
          number: previousSibling ? previousSibling._tree.number + 1 : 0,
        };
      });
      firstWalk(root);
      secondWalk(root, -root._tree.prelim);
      var left = d3_layout_treeSearch(root, d3_layout_treeLeftmost),
        right = d3_layout_treeSearch(root, d3_layout_treeRightmost),
        deep = d3_layout_treeSearch(root, d3_layout_treeDeepest),
        x0 = left.x - separation(left, right) / 2,
        x1 = right.x + separation(right, left) / 2,
        y1 = deep.depth || 1;
      d3_layout_treeVisitAfter(root, function (node) {
        node.x = ((node.x - x0) / (x1 - x0)) * size[0];
        node.y = (node.depth / y1) * size[1];
        delete node._tree;
      });
      return nodes;
    }
    tree.separation = function (x) {
      if (!arguments.length) return separation;
      separation = x;
      return tree;
    };
    tree.size = function (x) {
      if (!arguments.length) return size;
      size = x;
      return tree;
    };
    return d3_layout_hierarchyRebind(tree, hierarchy);
  };
  function d3_layout_treeSeparation(a, b) {
    return a.parent == b.parent ? 1 : 2;
  }
  function d3_layout_treeLeft(node) {
    var children = node.children;
    return children && children.length ? children[0] : node._tree.thread;
  }
  function d3_layout_treeRight(node) {
    var children = node.children,
      n;
    return children && (n = children.length)
      ? children[n - 1]
      : node._tree.thread;
  }
  function d3_layout_treeSearch(node, compare) {
    var children = node.children;
    if (children && (n = children.length)) {
      var child,
        n,
        i = -1;
      while (++i < n)
        if (
          compare((child = d3_layout_treeSearch(children[i], compare)), node) >
          0
        )
          node = child;
    }
    return node;
  }
  function d3_layout_treeRightmost(a, b) {
    return a.x - b.x;
  }
  function d3_layout_treeLeftmost(a, b) {
    return b.x - a.x;
  }
  function d3_layout_treeDeepest(a, b) {
    return a.depth - b.depth;
  }
  function d3_layout_treeVisitAfter(node, callback) {
    function visit(node, previousSibling) {
      var children = node.children;
      if (children && (n = children.length)) {
        var child,
          previousChild = null,
          i = -1,
          n;
        while (++i < n) {
          child = children[i];
          visit(child, previousChild);
          previousChild = child;
        }
      }
      callback(node, previousSibling);
    }
    visit(node, null);
  }
  function d3_layout_treeShift(node) {
    var shift = 0,
      change = 0,
      children = node.children,
      i = children.length,
      child;
    while (--i >= 0) {
      child = children[i]._tree;
      child.prelim += shift;
      child.mod += shift;
      shift += child.shift + (change += child.change);
    }
  }
  function d3_layout_treeMove(ancestor, node, shift) {
    ancestor = ancestor._tree;
    node = node._tree;
    var change = shift / (node.number - ancestor.number);
    ancestor.change += change;
    node.change -= change;
    node.shift += shift;
    node.prelim += shift;
    node.mod += shift;
  }
  function d3_layout_treeAncestor(vim, node, ancestor) {
    return vim._tree.ancestor.parent == node.parent
      ? vim._tree.ancestor
      : ancestor;
  }
  d3.layout.treemap = function () {
    var hierarchy = d3.layout.hierarchy(),
      round = Math.round,
      size = [1, 1],
      padding = null,
      pad = d3_layout_treemapPadNull,
      sticky = false,
      stickies,
      ratio = 0.5 * (1 + Math.sqrt(5));
    function scale(children, k) {
      var i = -1,
        n = children.length,
        child,
        area;
      while (++i < n) {
        area = (child = children[i]).value * (k < 0 ? 0 : k);
        child.area = isNaN(area) || area <= 0 ? 0 : area;
      }
    }
    function squarify(node) {
      var children = node.children;
      if (children && children.length) {
        var rect = pad(node),
          row = [],
          remaining = children.slice(),
          child,
          best = Infinity,
          score,
          u = Math.min(rect.dx, rect.dy),
          n;
        scale(remaining, (rect.dx * rect.dy) / node.value);
        row.area = 0;
        while ((n = remaining.length) > 0) {
          row.push((child = remaining[n - 1]));
          row.area += child.area;
          if ((score = worst(row, u)) <= best) {
            remaining.pop();
            best = score;
          } else {
            row.area -= row.pop().area;
            position(row, u, rect, false);
            u = Math.min(rect.dx, rect.dy);
            row.length = row.area = 0;
            best = Infinity;
          }
        }
        if (row.length) {
          position(row, u, rect, true);
          row.length = row.area = 0;
        }
        children.forEach(squarify);
      }
    }
    function stickify(node) {
      var children = node.children;
      if (children && children.length) {
        var rect = pad(node),
          remaining = children.slice(),
          child,
          row = [];
        scale(remaining, (rect.dx * rect.dy) / node.value);
        row.area = 0;
        while ((child = remaining.pop())) {
          row.push(child);
          row.area += child.area;
          if (child.z != null) {
            position(row, child.z ? rect.dx : rect.dy, rect, !remaining.length);
            row.length = row.area = 0;
          }
        }
        children.forEach(stickify);
      }
    }
    function worst(row, u) {
      var s = row.area,
        r,
        rmax = 0,
        rmin = Infinity,
        i = -1,
        n = row.length;
      while (++i < n) {
        if (!(r = row[i].area)) continue;
        if (r < rmin) rmin = r;
        if (r > rmax) rmax = r;
      }
      s *= s;
      u *= u;
      return s
        ? Math.max((u * rmax * ratio) / s, s / (u * rmin * ratio))
        : Infinity;
    }
    function position(row, u, rect, flush) {
      var i = -1,
        n = row.length,
        x = rect.x,
        y = rect.y,
        v = u ? round(row.area / u) : 0,
        o;
      if (u == rect.dx) {
        if (flush || v > rect.dy) v = rect.dy;
        while (++i < n) {
          o = row[i];
          o.x = x;
          o.y = y;
          o.dy = v;
          x += o.dx = Math.min(rect.x + rect.dx - x, v ? round(o.area / v) : 0);
        }
        o.z = true;
        o.dx += rect.x + rect.dx - x;
        rect.y += v;
        rect.dy -= v;
      } else {
        if (flush || v > rect.dx) v = rect.dx;
        while (++i < n) {
          o = row[i];
          o.x = x;
          o.y = y;
          o.dx = v;
          y += o.dy = Math.min(rect.y + rect.dy - y, v ? round(o.area / v) : 0);
        }
        o.z = false;
        o.dy += rect.y + rect.dy - y;
        rect.x += v;
        rect.dx -= v;
      }
    }
    function treemap(d) {
      var nodes = stickies || hierarchy(d),
        root = nodes[0];
      root.x = 0;
      root.y = 0;
      root.dx = size[0];
      root.dy = size[1];
      if (stickies) hierarchy.revalue(root);
      scale([root], (root.dx * root.dy) / root.value);
      (stickies ? stickify : squarify)(root);
      if (sticky) stickies = nodes;
      return nodes;
    }
    treemap.size = function (x) {
      if (!arguments.length) return size;
      size = x;
      return treemap;
    };
    treemap.padding = function (x) {
      if (!arguments.length) return padding;
      function padFunction(node) {
        var p = x.call(treemap, node, node.depth);
        return p == null
          ? d3_layout_treemapPadNull(node)
          : d3_layout_treemapPad(
              node,
              typeof p === "number" ? [p, p, p, p] : p
            );
      }
      function padConstant(node) {
        return d3_layout_treemapPad(node, x);
      }
      var type;
      pad =
        (padding = x) == null
          ? d3_layout_treemapPadNull
          : (type = typeof x) === "function"
          ? padFunction
          : type === "number"
          ? ((x = [x, x, x, x]), padConstant)
          : padConstant;
      return treemap;
    };
    treemap.round = function (x) {
      if (!arguments.length) return round != Number;
      round = x ? Math.round : Number;
      return treemap;
    };
    treemap.sticky = function (x) {
      if (!arguments.length) return sticky;
      sticky = x;
      stickies = null;
      return treemap;
    };
    treemap.ratio = function (x) {
      if (!arguments.length) return ratio;
      ratio = x;
      return treemap;
    };
    return d3_layout_hierarchyRebind(treemap, hierarchy);
  };
  function d3_layout_treemapPadNull(node) {
    return { x: node.x, y: node.y, dx: node.dx, dy: node.dy };
  }
  function d3_layout_treemapPad(node, padding) {
    var x = node.x + padding[3],
      y = node.y + padding[0],
      dx = node.dx - padding[1] - padding[3],
      dy = node.dy - padding[0] - padding[2];
    if (dx < 0) {
      x += dx / 2;
      dx = 0;
    }
    if (dy < 0) {
      y += dy / 2;
      dy = 0;
    }
    return { x: x, y: y, dx: dx, dy: dy };
  }
  d3.csv = function (url, callback) {
    d3.text(url, "text/csv", function (text) {
      callback(text && d3.csv.parse(text));
    });
  };
  d3.csv.parse = function (text) {
    var header;
    return d3.csv.parseRows(text, function (row, i) {
      if (i) {
        var o = {},
          j = -1,
          m = header.length;
        while (++j < m) o[header[j]] = row[j];
        return o;
      } else {
        header = row;
        return null;
      }
    });
  };
  d3.csv.parseRows = function (text, f) {
    var EOL = {},
      EOF = {},
      rows = [],
      re = /\r\n|[,\r\n]/g,
      n = 0,
      t,
      eol;
    re.lastIndex = 0;
    function token() {
      if (re.lastIndex >= text.length) return EOF;
      if (eol) {
        eol = false;
        return EOL;
      }
      var j = re.lastIndex;
      if (text.charCodeAt(j) === 34) {
        var i = j;
        while (i++ < text.length)
          if (text.charCodeAt(i) === 34) {
            if (text.charCodeAt(i + 1) !== 34) break;
            i++;
          }
        re.lastIndex = i + 2;
        var c = text.charCodeAt(i + 1);
        if (c === 13) {
          eol = true;
          if (text.charCodeAt(i + 2) === 10) re.lastIndex++;
        } else if (c === 10) eol = true;
        return text.substring(j + 1, i).replace(/""/g, '"');
      }
      var m = re.exec(text);
      if (m) {
        eol = m[0].charCodeAt(0) !== 44;
        return text.substring(j, m.index);
      }
      re.lastIndex = text.length;
      return text.substring(j);
    }
    while ((t = token()) !== EOF) {
      var a = [];
      while (t !== EOL && t !== EOF) {
        a.push(t);
        t = token();
      }
      if (f && !(a = f(a, n++))) continue;
      rows.push(a);
    }
    return rows;
  };
  d3.csv.format = function (rows) {
    return rows.map(d3_csv_formatRow).join("\n");
  };
  function d3_csv_formatRow(row) {
    return row.map(d3_csv_formatValue).join(",");
  }
  function d3_csv_formatValue(text) {
    return /[",\n]/.test(text) ? '"' + text.replace(/\"/g, '""') + '"' : text;
  }
  d3.geo = {};
  var d3_geo_radians = Math.PI / 180;
  d3.geo.azimuthal = function () {
    var mode = "orthographic",
      origin,
      scale = 200,
      translate = [480, 250],
      x0,
      y0,
      cy0,
      sy0;
    function azimuthal(coordinates) {
      var x1 = coordinates[0] * d3_geo_radians - x0,
        y1 = coordinates[1] * d3_geo_radians,
        cx1 = Math.cos(x1),
        sx1 = Math.sin(x1),
        cy1 = Math.cos(y1),
        sy1 = Math.sin(y1),
        cc = mode !== "orthographic" ? sy0 * sy1 + cy0 * cy1 * cx1 : null,
        c,
        k =
          mode === "stereographic"
            ? 1 / (1 + cc)
            : mode === "gnomonic"
            ? 1 / cc
            : mode === "equidistant"
            ? ((c = Math.acos(cc)), c ? c / Math.sin(c) : 0)
            : mode === "equalarea"
            ? Math.sqrt(2 / (1 + cc))
            : 1,
        x = k * cy1 * sx1,
        y = k * (sy0 * cy1 * cx1 - cy0 * sy1);
      return [scale * x + translate[0], scale * y + translate[1]];
    }
    azimuthal.invert = function (coordinates) {
      var x = (coordinates[0] - translate[0]) / scale,
        y = (coordinates[1] - translate[1]) / scale,
        p = Math.sqrt(x * x + y * y),
        c =
          mode === "stereographic"
            ? 2 * Math.atan(p)
            : mode === "gnomonic"
            ? Math.atan(p)
            : mode === "equidistant"
            ? p
            : mode === "equalarea"
            ? 2 * Math.asin(0.5 * p)
            : Math.asin(p),
        sc = Math.sin(c),
        cc = Math.cos(c);
      return [
        (x0 + Math.atan2(x * sc, p * cy0 * cc + y * sy0 * sc)) / d3_geo_radians,
        Math.asin(cc * sy0 - (p ? (y * sc * cy0) / p : 0)) / d3_geo_radians,
      ];
    };
    azimuthal.mode = function (x) {
      if (!arguments.length) return mode;
      mode = x + "";
      return azimuthal;
    };
    azimuthal.origin = function (x) {
      if (!arguments.length) return origin;
      origin = x;
      x0 = origin[0] * d3_geo_radians;
      y0 = origin[1] * d3_geo_radians;
      cy0 = Math.cos(y0);
      sy0 = Math.sin(y0);
      return azimuthal;
    };
    azimuthal.scale = function (x) {
      if (!arguments.length) return scale;
      scale = +x;
      return azimuthal;
    };
    azimuthal.translate = function (x) {
      if (!arguments.length) return translate;
      translate = [+x[0], +x[1]];
      return azimuthal;
    };
    return azimuthal.origin([0, 0]);
  };
  d3.geo.albers = function () {
    var origin = [-98, 38],
      parallels = [29.5, 45.5],
      scale = 1e3,
      translate = [480, 250],
      lng0,
      n,
      C,
      p0;
    function albers(coordinates) {
      var t = n * (d3_geo_radians * coordinates[0] - lng0),
        p =
          Math.sqrt(C - 2 * n * Math.sin(d3_geo_radians * coordinates[1])) / n;
      return [
        scale * p * Math.sin(t) + translate[0],
        scale * (p * Math.cos(t) - p0) + translate[1],
      ];
    }
    albers.invert = function (coordinates) {
      var x = (coordinates[0] - translate[0]) / scale,
        y = (coordinates[1] - translate[1]) / scale,
        p0y = p0 + y,
        t = Math.atan2(x, p0y),
        p = Math.sqrt(x * x + p0y * p0y);
      return [
        (lng0 + t / n) / d3_geo_radians,
        Math.asin((C - p * p * n * n) / (2 * n)) / d3_geo_radians,
      ];
    };
    function reload() {
      var phi1 = d3_geo_radians * parallels[0],
        phi2 = d3_geo_radians * parallels[1],
        lat0 = d3_geo_radians * origin[1],
        s = Math.sin(phi1),
        c = Math.cos(phi1);
      lng0 = d3_geo_radians * origin[0];
      n = 0.5 * (s + Math.sin(phi2));
      C = c * c + 2 * n * s;
      p0 = Math.sqrt(C - 2 * n * Math.sin(lat0)) / n;
      return albers;
    }
    albers.origin = function (x) {
      if (!arguments.length) return origin;
      origin = [+x[0], +x[1]];
      return reload();
    };
    albers.parallels = function (x) {
      if (!arguments.length) return parallels;
      parallels = [+x[0], +x[1]];
      return reload();
    };
    albers.scale = function (x) {
      if (!arguments.length) return scale;
      scale = +x;
      return albers;
    };
    albers.translate = function (x) {
      if (!arguments.length) return translate;
      translate = [+x[0], +x[1]];
      return albers;
    };
    return reload();
  };
  d3.geo.albersUsa = function () {
    var lower48 = d3.geo.albers();
    var alaska = d3.geo.albers().origin([-160, 60]).parallels([55, 65]);
    var hawaii = d3.geo.albers().origin([-160, 20]).parallels([8, 18]);
    var puertoRico = d3.geo.albers().origin([-60, 10]).parallels([8, 18]);
    function albersUsa(coordinates) {
      var lon = coordinates[0],
        lat = coordinates[1];
      return (
        lat > 50
          ? alaska
          : lon < -140
          ? hawaii
          : lat < 21
          ? puertoRico
          : lower48
      )(coordinates);
    }
    albersUsa.scale = function (x) {
      if (!arguments.length) return lower48.scale();
      lower48.scale(x);
      alaska.scale(x * 0.6);
      hawaii.scale(x);
      puertoRico.scale(x * 1.5);
      return albersUsa.translate(lower48.translate());
    };
    albersUsa.translate = function (x) {
      if (!arguments.length) return lower48.translate();
      var dz = lower48.scale() / 1e3,
        dx = x[0],
        dy = x[1];
      lower48.translate(x);
      alaska.translate([dx - 400 * dz, dy + 170 * dz]);
      hawaii.translate([dx - 190 * dz, dy + 200 * dz]);
      puertoRico.translate([dx + 580 * dz, dy + 430 * dz]);
      return albersUsa;
    };
    return albersUsa.scale(lower48.scale());
  };
  d3.geo.bonne = function () {
    var scale = 200,
      translate = [480, 250],
      x0,
      y0,
      y1,
      c1;
    function bonne(coordinates) {
      var x = coordinates[0] * d3_geo_radians - x0,
        y = coordinates[1] * d3_geo_radians - y0;
      if (y1) {
        var p = c1 + y1 - y,
          E = (x * Math.cos(y)) / p;
        x = p * Math.sin(E);
        y = p * Math.cos(E) - c1;
      } else {
        x *= Math.cos(y);
        y *= -1;
      }
      return [scale * x + translate[0], scale * y + translate[1]];
    }
    bonne.invert = function (coordinates) {
      var x = (coordinates[0] - translate[0]) / scale,
        y = (coordinates[1] - translate[1]) / scale;
      if (y1) {
        var c = c1 + y,
          p = Math.sqrt(x * x + c * c);
        y = c1 + y1 - p;
        x = x0 + (p * Math.atan2(x, c)) / Math.cos(y);
      } else {
        y *= -1;
        x /= Math.cos(y);
      }
      return [x / d3_geo_radians, y / d3_geo_radians];
    };
    bonne.parallel = function (x) {
      if (!arguments.length) return y1 / d3_geo_radians;
      c1 = 1 / Math.tan((y1 = x * d3_geo_radians));
      return bonne;
    };
    bonne.origin = function (x) {
      if (!arguments.length) return [x0 / d3_geo_radians, y0 / d3_geo_radians];
      x0 = x[0] * d3_geo_radians;
      y0 = x[1] * d3_geo_radians;
      return bonne;
    };
    bonne.scale = function (x) {
      if (!arguments.length) return scale;
      scale = +x;
      return bonne;
    };
    bonne.translate = function (x) {
      if (!arguments.length) return translate;
      translate = [+x[0], +x[1]];
      return bonne;
    };
    return bonne.origin([0, 0]).parallel(45);
  };
  d3.geo.equirectangular = function () {
    var scale = 500,
      translate = [480, 250];
    function equirectangular(coordinates) {
      var x = coordinates[0] / 360,
        y = -coordinates[1] / 360;
      return [scale * x + translate[0], scale * y + translate[1]];
    }
    equirectangular.invert = function (coordinates) {
      var x = (coordinates[0] - translate[0]) / scale,
        y = (coordinates[1] - translate[1]) / scale;
      return [360 * x, -360 * y];
    };
    equirectangular.scale = function (x) {
      if (!arguments.length) return scale;
      scale = +x;
      return equirectangular;
    };
    equirectangular.translate = function (x) {
      if (!arguments.length) return translate;
      translate = [+x[0], +x[1]];
      return equirectangular;
    };
    return equirectangular;
  };
  d3.geo.mercator = function () {
    var scale = 500,
      translate = [480, 250];
    function mercator(coordinates) {
      var x = coordinates[0] / 360,
        y =
          -(
            Math.log(
              Math.tan(Math.PI / 4 + (coordinates[1] * d3_geo_radians) / 2)
            ) / d3_geo_radians
          ) / 360;
      return [
        scale * x + translate[0],
        scale * Math.max(-0.5, Math.min(0.5, y)) + translate[1],
      ];
    }
    mercator.invert = function (coordinates) {
      var x = (coordinates[0] - translate[0]) / scale,
        y = (coordinates[1] - translate[1]) / scale;
      return [
        360 * x,
        (2 * Math.atan(Math.exp(-360 * y * d3_geo_radians))) / d3_geo_radians -
          90,
      ];
    };
    mercator.scale = function (x) {
      if (!arguments.length) return scale;
      scale = +x;
      return mercator;
    };
    mercator.translate = function (x) {
      if (!arguments.length) return translate;
      translate = [+x[0], +x[1]];
      return mercator;
    };
    return mercator;
  };
  function d3_geo_type(types, defaultValue) {
    return function (object) {
      return object && types.hasOwnProperty(object.type)
        ? types[object.type](object)
        : defaultValue;
    };
  }
  d3.geo.path = function () {
    var pointRadius = 4.5,
      pointCircle = d3_path_circle(pointRadius),
      projection = d3.geo.albersUsa(),
      buffer = [];
    function path(d, i) {
      if (typeof pointRadius === "function")
        pointCircle = d3_path_circle(pointRadius.apply(this, arguments));
      pathType(d);
      var result = buffer.length ? buffer.join("") : null;
      buffer = [];
      return result;
    }
    function project(coordinates) {
      return projection(coordinates).join(",");
    }
    var pathType = d3_geo_type({
      FeatureCollection: function (o) {
        var features = o.features,
          i = -1,
          n = features.length;
        while (++i < n) buffer.push(pathType(features[i].geometry));
      },
      Feature: function (o) {
        pathType(o.geometry);
      },
      Point: function (o) {
        buffer.push("M", project(o.coordinates), pointCircle);
      },
      MultiPoint: function (o) {
        var coordinates = o.coordinates,
          i = -1,
          n = coordinates.length;
        while (++i < n) buffer.push("M", project(coordinates[i]), pointCircle);
      },
      LineString: function (o) {
        var coordinates = o.coordinates,
          i = -1,
          n = coordinates.length;
        buffer.push("M");
        while (++i < n) buffer.push(project(coordinates[i]), "L");
        buffer.pop();
      },
      MultiLineString: function (o) {
        var coordinates = o.coordinates,
          i = -1,
          n = coordinates.length,
          subcoordinates,
          j,
          m;
        while (++i < n) {
          subcoordinates = coordinates[i];
          j = -1;
          m = subcoordinates.length;
          buffer.push("M");
          while (++j < m) buffer.push(project(subcoordinates[j]), "L");
          buffer.pop();
        }
      },
      Polygon: function (o) {
        var coordinates = o.coordinates,
          i = -1,
          n = coordinates.length,
          subcoordinates,
          j,
          m;
        while (++i < n) {
          subcoordinates = coordinates[i];
          j = -1;
          if ((m = subcoordinates.length - 1) > 0) {
            buffer.push("M");
            while (++j < m) buffer.push(project(subcoordinates[j]), "L");
            buffer[buffer.length - 1] = "Z";
          }
        }
      },
      MultiPolygon: function (o) {
        var coordinates = o.coordinates,
          i = -1,
          n = coordinates.length,
          subcoordinates,
          j,
          m,
          subsubcoordinates,
          k,
          p;
        while (++i < n) {
          subcoordinates = coordinates[i];
          j = -1;
          m = subcoordinates.length;
          while (++j < m) {
            subsubcoordinates = subcoordinates[j];
            k = -1;
            if ((p = subsubcoordinates.length - 1) > 0) {
              buffer.push("M");
              while (++k < p) buffer.push(project(subsubcoordinates[k]), "L");
              buffer[buffer.length - 1] = "Z";
            }
          }
        }
      },
      GeometryCollection: function (o) {
        var geometries = o.geometries,
          i = -1,
          n = geometries.length;
        while (++i < n) buffer.push(pathType(geometries[i]));
      },
    });
    var areaType = (path.area = d3_geo_type(
      {
        FeatureCollection: function (o) {
          var area = 0,
            features = o.features,
            i = -1,
            n = features.length;
          while (++i < n) area += areaType(features[i]);
          return area;
        },
        Feature: function (o) {
          return areaType(o.geometry);
        },
        Polygon: function (o) {
          return polygonArea(o.coordinates);
        },
        MultiPolygon: function (o) {
          var sum = 0,
            coordinates = o.coordinates,
            i = -1,
            n = coordinates.length;
          while (++i < n) sum += polygonArea(coordinates[i]);
          return sum;
        },
        GeometryCollection: function (o) {
          var sum = 0,
            geometries = o.geometries,
            i = -1,
            n = geometries.length;
          while (++i < n) sum += areaType(geometries[i]);
          return sum;
        },
      },
      0
    ));
    function polygonArea(coordinates) {
      var sum = area(coordinates[0]),
        i = 0,
        n = coordinates.length;
      while (++i < n) sum -= area(coordinates[i]);
      return sum;
    }
    function polygonCentroid(coordinates) {
      var polygon = d3.geom.polygon(coordinates[0].map(projection)),
        area = polygon.area(),
        centroid = polygon.centroid(area < 0 ? ((area *= -1), 1) : -1),
        x = centroid[0],
        y = centroid[1],
        z = area,
        i = 0,
        n = coordinates.length;
      while (++i < n) {
        polygon = d3.geom.polygon(coordinates[i].map(projection));
        area = polygon.area();
        centroid = polygon.centroid(area < 0 ? ((area *= -1), 1) : -1);
        x -= centroid[0];
        y -= centroid[1];
        z -= area;
      }
      return [x, y, 6 * z];
    }
    var centroidType = (path.centroid = d3_geo_type({
      Feature: function (o) {
        return centroidType(o.geometry);
      },
      Polygon: function (o) {
        var centroid = polygonCentroid(o.coordinates);
        return [centroid[0] / centroid[2], centroid[1] / centroid[2]];
      },
      MultiPolygon: function (o) {
        var area = 0,
          coordinates = o.coordinates,
          centroid,
          x = 0,
          y = 0,
          z = 0,
          i = -1,
          n = coordinates.length;
        while (++i < n) {
          centroid = polygonCentroid(coordinates[i]);
          x += centroid[0];
          y += centroid[1];
          z += centroid[2];
        }
        return [x / z, y / z];
      },
    }));
    function area(coordinates) {
      return Math.abs(d3.geom.polygon(coordinates.map(projection)).area());
    }
    path.projection = function (x) {
      projection = x;
      return path;
    };
    path.pointRadius = function (x) {
      if (typeof x === "function") pointRadius = x;
      else {
        pointRadius = +x;
        pointCircle = d3_path_circle(pointRadius);
      }
      return path;
    };
    return path;
  };
  function d3_path_circle(radius) {
    return (
      "m0," +
      radius +
      "a" +
      radius +
      "," +
      radius +
      " 0 1,1 0," +
      -2 * radius +
      "a" +
      radius +
      "," +
      radius +
      " 0 1,1 0," +
      +2 * radius +
      "z"
    );
  }
  d3.geo.bounds = function (feature) {
    var left = Infinity,
      bottom = Infinity,
      right = -Infinity,
      top = -Infinity;
    d3_geo_bounds(feature, function (x, y) {
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < bottom) bottom = y;
      if (y > top) top = y;
    });
    return [
      [left, bottom],
      [right, top],
    ];
  };
  function d3_geo_bounds(o, f) {
    if (d3_geo_boundsTypes.hasOwnProperty(o.type))
      d3_geo_boundsTypes[o.type](o, f);
  }
  var d3_geo_boundsTypes = {
    Feature: d3_geo_boundsFeature,
    FeatureCollection: d3_geo_boundsFeatureCollection,
    GeometryCollection: d3_geo_boundsGeometryCollection,
    LineString: d3_geo_boundsLineString,
    MultiLineString: d3_geo_boundsMultiLineString,
    MultiPoint: d3_geo_boundsLineString,
    MultiPolygon: d3_geo_boundsMultiPolygon,
    Point: d3_geo_boundsPoint,
    Polygon: d3_geo_boundsPolygon,
  };
  function d3_geo_boundsFeature(o, f) {
    d3_geo_bounds(o.geometry, f);
  }
  function d3_geo_boundsFeatureCollection(o, f) {
    for (var a = o.features, i = 0, n = a.length; i < n; i++)
      d3_geo_bounds(a[i].geometry, f);
  }
  function d3_geo_boundsGeometryCollection(o, f) {
    for (var a = o.geometries, i = 0, n = a.length; i < n; i++)
      d3_geo_bounds(a[i], f);
  }
  function d3_geo_boundsLineString(o, f) {
    for (var a = o.coordinates, i = 0, n = a.length; i < n; i++)
      f.apply(null, a[i]);
  }
  function d3_geo_boundsMultiLineString(o, f) {
    for (var a = o.coordinates, i = 0, n = a.length; i < n; i++)
      for (var b = a[i], j = 0, m = b.length; j < m; j++) f.apply(null, b[j]);
  }
  function d3_geo_boundsMultiPolygon(o, f) {
    for (var a = o.coordinates, i = 0, n = a.length; i < n; i++)
      for (var b = a[i][0], j = 0, m = b.length; j < m; j++)
        f.apply(null, b[j]);
  }
  function d3_geo_boundsPoint(o, f) {
    f.apply(null, o.coordinates);
  }
  function d3_geo_boundsPolygon(o, f) {
    for (var a = o.coordinates[0], i = 0, n = a.length; i < n; i++)
      f.apply(null, a[i]);
  }
  d3.geo.circle = function () {
    var origin = [0, 0],
      degrees = 90 - 0.01,
      radians = degrees * d3_geo_radians,
      arc = d3.geo.greatArc().source(origin).target(d3_identity);
    function circle() {}
    function visible(point) {
      return arc.distance(point) < radians;
    }
    circle.clip = function (d) {
      if (typeof origin === "function")
        arc.source(origin.apply(this, arguments));
      return clipType(d) || null;
    };
    var clipType = d3_geo_type({
      FeatureCollection: function (o) {
        var features = o.features.map(clipType).filter(d3_identity);
        return features && ((o = Object.create(o)), (o.features = features), o);
      },
      Feature: function (o) {
        var geometry = clipType(o.geometry);
        return geometry && ((o = Object.create(o)), (o.geometry = geometry), o);
      },
      Point: function (o) {
        return visible(o.coordinates) && o;
      },
      MultiPoint: function (o) {
        var coordinates = o.coordinates.filter(visible);
        return coordinates.length && { type: o.type, coordinates: coordinates };
      },
      LineString: function (o) {
        var coordinates = clip(o.coordinates);
        return (
          coordinates.length &&
          ((o = Object.create(o)), (o.coordinates = coordinates), o)
        );
      },
      MultiLineString: function (o) {
        var coordinates = o.coordinates.map(clip).filter(function (d) {
          return d.length;
        });
        return (
          coordinates.length &&
          ((o = Object.create(o)), (o.coordinates = coordinates), o)
        );
      },
      Polygon: function (o) {
        var coordinates = o.coordinates.map(clip);
        return (
          coordinates[0].length &&
          ((o = Object.create(o)), (o.coordinates = coordinates), o)
        );
      },
      MultiPolygon: function (o) {
        var coordinates = o.coordinates
          .map(function (d) {
            return d.map(clip);
          })
          .filter(function (d) {
            return d[0].length;
          });
        return (
          coordinates.length &&
          ((o = Object.create(o)), (o.coordinates = coordinates), o)
        );
      },
      GeometryCollection: function (o) {
        var geometries = o.geometries.map(clipType).filter(d3_identity);
        return (
          geometries.length &&
          ((o = Object.create(o)), (o.geometries = geometries), o)
        );
      },
    });
    function clip(coordinates) {
      var i = -1,
        n = coordinates.length,
        clipped = [],
        p0,
        p1,
        p2,
        d0,
        d1;
      while (++i < n) {
        d1 = arc.distance((p2 = coordinates[i]));
        if (d1 < radians) {
          if (p1)
            clipped.push(
              d3_geo_greatArcInterpolate(p1, p2)((d0 - radians) / (d0 - d1))
            );
          clipped.push(p2);
          p0 = p1 = null;
        } else {
          p1 = p2;
          if (!p0 && clipped.length) {
            clipped.push(
              d3_geo_greatArcInterpolate(
                clipped[clipped.length - 1],
                p1
              )((radians - d0) / (d1 - d0))
            );
            p0 = p1;
          }
        }
        d0 = d1;
      }
      p0 = coordinates[0];
      p1 = clipped[0];
      if (
        p1 &&
        p2[0] === p0[0] &&
        p2[1] === p0[1] &&
        !(p2[0] === p1[0] && p2[1] === p1[1])
      )
        clipped.push(p1);
      return resample(clipped);
    }
    function resample(coordinates) {
      var i = 0,
        n = coordinates.length,
        j,
        m,
        resampled = n ? [coordinates[0]] : coordinates,
        resamples,
        origin = arc.source();
      while (++i < n) {
        resamples = arc.source(coordinates[i - 1])(coordinates[i]).coordinates;
        for (j = 0, m = resamples.length; ++j < m; )
          resampled.push(resamples[j]);
      }
      arc.source(origin);
      return resampled;
    }
    circle.origin = function (x) {
      if (!arguments.length) return origin;
      origin = x;
      if (typeof origin !== "function") arc.source(origin);
      return circle;
    };
    circle.angle = function (x) {
      if (!arguments.length) return degrees;
      radians = (degrees = +x) * d3_geo_radians;
      return circle;
    };
    return d3.rebind(circle, arc, "precision");
  };
  d3.geo.greatArc = function () {
    var source = d3_geo_greatArcSource,
      p0,
      target = d3_geo_greatArcTarget,
      p1,
      precision = 6 * d3_geo_radians,
      interpolate = d3_geo_greatArcInterpolator();
    function greatArc() {
      var d = greatArc.distance.apply(this, arguments),
        t = 0,
        dt = precision / d,
        coordinates = [p0];
      while ((t += dt) < 1) coordinates.push(interpolate(t));
      coordinates.push(p1);
      return { type: "LineString", coordinates: coordinates };
    }
    greatArc.distance = function () {
      if (typeof source === "function")
        interpolate.source((p0 = source.apply(this, arguments)));
      if (typeof target === "function")
        interpolate.target((p1 = target.apply(this, arguments)));
      return interpolate.distance();
    };
    greatArc.source = function (_) {
      if (!arguments.length) return source;
      source = _;
      if (typeof source !== "function") interpolate.source((p0 = source));
      return greatArc;
    };
    greatArc.target = function (_) {
      if (!arguments.length) return target;
      target = _;
      if (typeof target !== "function") interpolate.target((p1 = target));
      return greatArc;
    };
    greatArc.precision = function (_) {
      if (!arguments.length) return precision / d3_geo_radians;
      precision = _ * d3_geo_radians;
      return greatArc;
    };
    return greatArc;
  };
  function d3_geo_greatArcSource(d) {
    return d.source;
  }
  function d3_geo_greatArcTarget(d) {
    return d.target;
  }
  function d3_geo_greatArcInterpolator() {
    var x0, y0, cy0, sy0, kx0, ky0, x1, y1, cy1, sy1, kx1, ky1, d, k;
    function interpolate(t) {
      var B = Math.sin((t *= d)) * k,
        A = Math.sin(d - t) * k,
        x = A * kx0 + B * kx1,
        y = A * ky0 + B * ky1,
        z = A * sy0 + B * sy1;
      return [
        Math.atan2(y, x) / d3_geo_radians,
        Math.atan2(z, Math.sqrt(x * x + y * y)) / d3_geo_radians,
      ];
    }
    interpolate.distance = function () {
      if (d == null)
        k =
          1 /
          Math.sin(
            (d = Math.acos(
              Math.max(
                -1,
                Math.min(1, sy0 * sy1 + cy0 * cy1 * Math.cos(x1 - x0))
              )
            ))
          );
      return d;
    };
    interpolate.source = function (_) {
      var cx0 = Math.cos((x0 = _[0] * d3_geo_radians)),
        sx0 = Math.sin(x0);
      cy0 = Math.cos((y0 = _[1] * d3_geo_radians));
      sy0 = Math.sin(y0);
      kx0 = cy0 * cx0;
      ky0 = cy0 * sx0;
      d = null;
      return interpolate;
    };
    interpolate.target = function (_) {
      var cx1 = Math.cos((x1 = _[0] * d3_geo_radians)),
        sx1 = Math.sin(x1);
      cy1 = Math.cos((y1 = _[1] * d3_geo_radians));
      sy1 = Math.sin(y1);
      kx1 = cy1 * cx1;
      ky1 = cy1 * sx1;
      d = null;
      return interpolate;
    };
    return interpolate;
  }
  function d3_geo_greatArcInterpolate(a, b) {
    var i = d3_geo_greatArcInterpolator().source(a).target(b);
    i.distance();
    return i;
  }
  d3.geo.greatCircle = d3.geo.circle;
  d3.geom = {};
  d3.geom.contour = function (grid, start) {
    var s = start || d3_geom_contourStart(grid),
      c = [],
      x = s[0],
      y = s[1],
      dx = 0,
      dy = 0,
      pdx = NaN,
      pdy = NaN,
      i = 0;
    do {
      i = 0;
      if (grid(x - 1, y - 1)) i += 1;
      if (grid(x, y - 1)) i += 2;
      if (grid(x - 1, y)) i += 4;
      if (grid(x, y)) i += 8;
      if (i === 6) {
        dx = pdy === -1 ? -1 : 1;
        dy = 0;
      } else if (i === 9) {
        dx = 0;
        dy = pdx === 1 ? -1 : 1;
      } else {
        dx = d3_geom_contourDx[i];
        dy = d3_geom_contourDy[i];
      }
      if (dx != pdx && dy != pdy) {
        c.push([x, y]);
        pdx = dx;
        pdy = dy;
      }
      x += dx;
      y += dy;
    } while (s[0] != x || s[1] != y);
    return c;
  };
  var d3_geom_contourDx = [
      1,
      0,
      1,
      1,
      -1,
      0,
      -1,
      1,
      0,
      0,
      0,
      0,
      -1,
      0,
      -1,
      NaN,
    ],
    d3_geom_contourDy = [0, -1, 0, 0, 0, -1, 0, 0, 1, -1, 1, 1, 0, -1, 0, NaN];
  function d3_geom_contourStart(grid) {
    var x = 0,
      y = 0;
    while (true) {
      if (grid(x, y)) return [x, y];
      if (x === 0) {
        x = y + 1;
        y = 0;
      } else {
        x = x - 1;
        y = y + 1;
      }
    }
  }
  d3.geom.hull = function (vertices) {
    if (vertices.length < 3) return [];
    var len = vertices.length,
      plen = len - 1,
      points = [],
      stack = [],
      i,
      j,
      h = 0,
      x1,
      y1,
      x2,
      y2,
      u,
      v,
      a,
      sp;
    for (i = 1; i < len; ++i)
      if (vertices[i][1] < vertices[h][1]) h = i;
      else if (vertices[i][1] == vertices[h][1])
        h = vertices[i][0] < vertices[h][0] ? i : h;
    for (i = 0; i < len; ++i) {
      if (i === h) continue;
      y1 = vertices[i][1] - vertices[h][1];
      x1 = vertices[i][0] - vertices[h][0];
      points.push({ angle: Math.atan2(y1, x1), index: i });
    }
    points.sort(function (a, b) {
      return a.angle - b.angle;
    });
    a = points[0].angle;
    v = points[0].index;
    u = 0;
    for (i = 1; i < plen; ++i) {
      j = points[i].index;
      if (a == points[i].angle) {
        x1 = vertices[v][0] - vertices[h][0];
        y1 = vertices[v][1] - vertices[h][1];
        x2 = vertices[j][0] - vertices[h][0];
        y2 = vertices[j][1] - vertices[h][1];
        if (x1 * x1 + y1 * y1 >= x2 * x2 + y2 * y2) points[i].index = -1;
        else {
          points[u].index = -1;
          a = points[i].angle;
          u = i;
          v = j;
        }
      } else {
        a = points[i].angle;
        u = i;
        v = j;
      }
    }
    stack.push(h);
    for (i = 0, j = 0; i < 2; ++j)
      if (points[j].index !== -1) {
        stack.push(points[j].index);
        i++;
      }
    sp = stack.length;
    for (; j < plen; ++j) {
      if (points[j].index === -1) continue;
      while (
        !d3_geom_hullCCW(
          stack[sp - 2],
          stack[sp - 1],
          points[j].index,
          vertices
        )
      )
        --sp;
      stack[sp++] = points[j].index;
    }
    var poly = [];
    for (i = 0; i < sp; ++i) poly.push(vertices[stack[i]]);
    return poly;
  };
  function d3_geom_hullCCW(i1, i2, i3, v) {
    var t, a, b, c, d, e, f;
    t = v[i1];
    a = t[0];
    b = t[1];
    t = v[i2];
    c = t[0];
    d = t[1];
    t = v[i3];
    e = t[0];
    f = t[1];
    return (f - b) * (c - a) - (d - b) * (e - a) > 0;
  }
  d3.geom.polygon = function (coordinates) {
    coordinates.area = function () {
      var i = 0,
        n = coordinates.length,
        a = coordinates[n - 1][0] * coordinates[0][1],
        b = coordinates[n - 1][1] * coordinates[0][0];
      while (++i < n) {
        a += coordinates[i - 1][0] * coordinates[i][1];
        b += coordinates[i - 1][1] * coordinates[i][0];
      }
      return (b - a) * 0.5;
    };
    coordinates.centroid = function (k) {
      var i = -1,
        n = coordinates.length,
        x = 0,
        y = 0,
        a,
        b = coordinates[n - 1],
        c;
      if (!arguments.length) k = -1 / (6 * coordinates.area());
      while (++i < n) {
        a = b;
        b = coordinates[i];
        c = a[0] * b[1] - b[0] * a[1];
        x += (a[0] + b[0]) * c;
        y += (a[1] + b[1]) * c;
      }
      return [x * k, y * k];
    };
    coordinates.clip = function (subject) {
      var input,
        i = -1,
        n = coordinates.length,
        j,
        m,
        a = coordinates[n - 1],
        b,
        c,
        d;
      while (++i < n) {
        input = subject.slice();
        subject.length = 0;
        b = coordinates[i];
        c = input[(m = input.length) - 1];
        j = -1;
        while (++j < m) {
          d = input[j];
          if (d3_geom_polygonInside(d, a, b)) {
            if (!d3_geom_polygonInside(c, a, b))
              subject.push(d3_geom_polygonIntersect(c, d, a, b));
            subject.push(d);
          } else if (d3_geom_polygonInside(c, a, b))
            subject.push(d3_geom_polygonIntersect(c, d, a, b));
          c = d;
        }
        a = b;
      }
      return subject;
    };
    return coordinates;
  };
  function d3_geom_polygonInside(p, a, b) {
    return (b[0] - a[0]) * (p[1] - a[1]) < (b[1] - a[1]) * (p[0] - a[0]);
  }
  function d3_geom_polygonIntersect(c, d, a, b) {
    var x1 = c[0],
      x2 = d[0],
      x3 = a[0],
      x4 = b[0],
      y1 = c[1],
      y2 = d[1],
      y3 = a[1],
      y4 = b[1],
      x13 = x1 - x3,
      x21 = x2 - x1,
      x43 = x4 - x3,
      y13 = y1 - y3,
      y21 = y2 - y1,
      y43 = y4 - y3,
      ua = (x43 * y13 - y43 * x13) / (y43 * x21 - x43 * y21);
    return [x1 + ua * x21, y1 + ua * y21];
  }
  d3.geom.voronoi = function (vertices) {
    var polygons = vertices.map(function () {
      return [];
    });
    d3_voronoi_tessellate(vertices, function (e) {
      var s1, s2, x1, x2, y1, y2;
      if (e.a === 1 && e.b >= 0) {
        s1 = e.ep.r;
        s2 = e.ep.l;
      } else {
        s1 = e.ep.l;
        s2 = e.ep.r;
      }
      if (e.a === 1) {
        y1 = s1 ? s1.y : -1e6;
        x1 = e.c - e.b * y1;
        y2 = s2 ? s2.y : 1e6;
        x2 = e.c - e.b * y2;
      } else {
        x1 = s1 ? s1.x : -1e6;
        y1 = e.c - e.a * x1;
        x2 = s2 ? s2.x : 1e6;
        y2 = e.c - e.a * x2;
      }
      var v1 = [x1, y1],
        v2 = [x2, y2];
      polygons[e.region.l.index].push(v1, v2);
      polygons[e.region.r.index].push(v1, v2);
    });
    return polygons.map(function (polygon, i) {
      var cx = vertices[i][0],
        cy = vertices[i][1];
      polygon.forEach(function (v) {
        v.angle = Math.atan2(v[0] - cx, v[1] - cy);
      });
      return polygon
        .sort(function (a, b) {
          return a.angle - b.angle;
        })
        .filter(function (d, i) {
          return !i || d.angle - polygon[i - 1].angle > 1e-10;
        });
    });
  };
  var d3_voronoi_opposite = { l: "r", r: "l" };
  function d3_voronoi_tessellate(vertices, callback) {
    var Sites = {
      list: vertices
        .map(function (v, i) {
          return { index: i, x: v[0], y: v[1] };
        })
        .sort(function (a, b) {
          return a.y < b.y
            ? -1
            : a.y > b.y
            ? 1
            : a.x < b.x
            ? -1
            : a.x > b.x
            ? 1
            : 0;
        }),
      bottomSite: null,
    };
    var EdgeList = {
      list: [],
      leftEnd: null,
      rightEnd: null,
      init: function () {
        EdgeList.leftEnd = EdgeList.createHalfEdge(null, "l");
        EdgeList.rightEnd = EdgeList.createHalfEdge(null, "l");
        EdgeList.leftEnd.r = EdgeList.rightEnd;
        EdgeList.rightEnd.l = EdgeList.leftEnd;
        EdgeList.list.unshift(EdgeList.leftEnd, EdgeList.rightEnd);
      },
      createHalfEdge: function (edge, side) {
        return { edge: edge, side: side, vertex: null, l: null, r: null };
      },
      insert: function (lb, he) {
        he.l = lb;
        he.r = lb.r;
        lb.r.l = he;
        lb.r = he;
      },
      leftBound: function (p) {
        var he = EdgeList.leftEnd;
        do he = he.r;
        while (he != EdgeList.rightEnd && Geom.rightOf(he, p));
        he = he.l;
        return he;
      },
      del: function (he) {
        he.l.r = he.r;
        he.r.l = he.l;
        he.edge = null;
      },
      right: function (he) {
        return he.r;
      },
      left: function (he) {
        return he.l;
      },
      leftRegion: function (he) {
        return he.edge == null ? Sites.bottomSite : he.edge.region[he.side];
      },
      rightRegion: function (he) {
        return he.edge == null
          ? Sites.bottomSite
          : he.edge.region[d3_voronoi_opposite[he.side]];
      },
    };
    var Geom = {
      bisect: function (s1, s2) {
        var newEdge = { region: { l: s1, r: s2 }, ep: { l: null, r: null } };
        var dx = s2.x - s1.x,
          dy = s2.y - s1.y,
          adx = dx > 0 ? dx : -dx,
          ady = dy > 0 ? dy : -dy;
        newEdge.c = s1.x * dx + s1.y * dy + (dx * dx + dy * dy) * 0.5;
        if (adx > ady) {
          newEdge.a = 1;
          newEdge.b = dy / dx;
          newEdge.c /= dx;
        } else {
          newEdge.b = 1;
          newEdge.a = dx / dy;
          newEdge.c /= dy;
        }
        return newEdge;
      },
      intersect: function (el1, el2) {
        var e1 = el1.edge,
          e2 = el2.edge;
        if (!e1 || !e2 || e1.region.r == e2.region.r) return null;
        var d = e1.a * e2.b - e1.b * e2.a;
        if (Math.abs(d) < 1e-10) return null;
        var xint = (e1.c * e2.b - e2.c * e1.b) / d,
          yint = (e2.c * e1.a - e1.c * e2.a) / d,
          e1r = e1.region.r,
          e2r = e2.region.r,
          el,
          e;
        if (e1r.y < e2r.y || (e1r.y == e2r.y && e1r.x < e2r.x)) {
          el = el1;
          e = e1;
        } else {
          el = el2;
          e = e2;
        }
        var rightOfSite = xint >= e.region.r.x;
        if (
          (rightOfSite && el.side === "l") ||
          (!rightOfSite && el.side === "r")
        )
          return null;
        return { x: xint, y: yint };
      },
      rightOf: function (he, p) {
        var e = he.edge,
          topsite = e.region.r,
          rightOfSite = p.x > topsite.x;
        if (rightOfSite && he.side === "l") return 1;
        if (!rightOfSite && he.side === "r") return 0;
        if (e.a === 1) {
          var dyp = p.y - topsite.y,
            dxp = p.x - topsite.x,
            fast = 0,
            above = 0;
          if ((!rightOfSite && e.b < 0) || (rightOfSite && e.b >= 0))
            above = fast = dyp >= e.b * dxp;
          else {
            above = p.x + p.y * e.b > e.c;
            if (e.b < 0) above = !above;
            if (!above) fast = 1;
          }
          if (!fast) {
            var dxs = topsite.x - e.region.l.x;
            above =
              e.b * (dxp * dxp - dyp * dyp) <
              dxs * dyp * (1 + (2 * dxp) / dxs + e.b * e.b);
            if (e.b < 0) above = !above;
          }
        } else {
          var yl = e.c - e.a * p.x,
            t1 = p.y - yl,
            t2 = p.x - topsite.x,
            t3 = yl - topsite.y;
          above = t1 * t1 > t2 * t2 + t3 * t3;
        }
        return he.side === "l" ? above : !above;
      },
      endPoint: function (edge, side, site) {
        edge.ep[side] = site;
        if (!edge.ep[d3_voronoi_opposite[side]]) return;
        callback(edge);
      },
      distance: function (s, t) {
        var dx = s.x - t.x,
          dy = s.y - t.y;
        return Math.sqrt(dx * dx + dy * dy);
      },
    };
    var EventQueue = {
      list: [],
      insert: function (he, site, offset) {
        he.vertex = site;
        he.ystar = site.y + offset;
        for (var i = 0, list = EventQueue.list, l = list.length; i < l; i++) {
          var next = list[i];
          if (
            he.ystar > next.ystar ||
            (he.ystar == next.ystar && site.x > next.vertex.x)
          )
            continue;
          else break;
        }
        list.splice(i, 0, he);
      },
      del: function (he) {
        for (
          var i = 0, ls = EventQueue.list, l = ls.length;
          i < l && ls[i] != he;
          ++i
        );
        ls.splice(i, 1);
      },
      empty: function () {
        return EventQueue.list.length === 0;
      },
      nextEvent: function (he) {
        for (var i = 0, ls = EventQueue.list, l = ls.length; i < l; ++i)
          if (ls[i] == he) return ls[i + 1];
        return null;
      },
      min: function () {
        var elem = EventQueue.list[0];
        return { x: elem.vertex.x, y: elem.ystar };
      },
      extractMin: function () {
        return EventQueue.list.shift();
      },
    };
    EdgeList.init();
    Sites.bottomSite = Sites.list.shift();
    var newSite = Sites.list.shift(),
      newIntStar;
    var lbnd, rbnd, llbnd, rrbnd, bisector;
    var bot, top, temp, p, v;
    var e, pm;
    while (true) {
      if (!EventQueue.empty()) newIntStar = EventQueue.min();
      if (
        newSite &&
        (EventQueue.empty() ||
          newSite.y < newIntStar.y ||
          (newSite.y == newIntStar.y && newSite.x < newIntStar.x))
      ) {
        lbnd = EdgeList.leftBound(newSite);
        rbnd = EdgeList.right(lbnd);
        bot = EdgeList.rightRegion(lbnd);
        e = Geom.bisect(bot, newSite);
        bisector = EdgeList.createHalfEdge(e, "l");
        EdgeList.insert(lbnd, bisector);
        p = Geom.intersect(lbnd, bisector);
        if (p) {
          EventQueue.del(lbnd);
          EventQueue.insert(lbnd, p, Geom.distance(p, newSite));
        }
        lbnd = bisector;
        bisector = EdgeList.createHalfEdge(e, "r");
        EdgeList.insert(lbnd, bisector);
        p = Geom.intersect(bisector, rbnd);
        if (p) EventQueue.insert(bisector, p, Geom.distance(p, newSite));
        newSite = Sites.list.shift();
      } else if (!EventQueue.empty()) {
        lbnd = EventQueue.extractMin();
        llbnd = EdgeList.left(lbnd);
        rbnd = EdgeList.right(lbnd);
        rrbnd = EdgeList.right(rbnd);
        bot = EdgeList.leftRegion(lbnd);
        top = EdgeList.rightRegion(rbnd);
        v = lbnd.vertex;
        Geom.endPoint(lbnd.edge, lbnd.side, v);
        Geom.endPoint(rbnd.edge, rbnd.side, v);
        EdgeList.del(lbnd);
        EventQueue.del(rbnd);
        EdgeList.del(rbnd);
        pm = "l";
        if (bot.y > top.y) {
          temp = bot;
          bot = top;
          top = temp;
          pm = "r";
        }
        e = Geom.bisect(bot, top);
        bisector = EdgeList.createHalfEdge(e, pm);
        EdgeList.insert(llbnd, bisector);
        Geom.endPoint(e, d3_voronoi_opposite[pm], v);
        p = Geom.intersect(llbnd, bisector);
        if (p) {
          EventQueue.del(llbnd);
          EventQueue.insert(llbnd, p, Geom.distance(p, bot));
        }
        p = Geom.intersect(bisector, rrbnd);
        if (p) EventQueue.insert(bisector, p, Geom.distance(p, bot));
      } else break;
    }
    for (
      lbnd = EdgeList.right(EdgeList.leftEnd);
      lbnd != EdgeList.rightEnd;
      lbnd = EdgeList.right(lbnd)
    )
      callback(lbnd.edge);
  }
  d3.geom.delaunay = function (vertices) {
    var edges = vertices.map(function () {
        return [];
      }),
      triangles = [];
    d3_voronoi_tessellate(vertices, function (e) {
      edges[e.region.l.index].push(vertices[e.region.r.index]);
    });
    edges.forEach(function (edge, i) {
      var v = vertices[i],
        cx = v[0],
        cy = v[1];
      edge.forEach(function (v) {
        v.angle = Math.atan2(v[0] - cx, v[1] - cy);
      });
      edge.sort(function (a, b) {
        return a.angle - b.angle;
      });
      for (var j = 0, m = edge.length - 1; j < m; j++)
        triangles.push([v, edge[j], edge[j + 1]]);
    });
    return triangles;
  };
  d3.geom.quadtree = function (points, x1, y1, x2, y2) {
    var p,
      i = -1,
      n = points.length;
    if (n && isNaN(points[0].x)) points = points.map(d3_geom_quadtreePoint);
    if (arguments.length < 5)
      if (arguments.length === 3) {
        y2 = x2 = y1;
        y1 = x1;
      } else {
        x1 = y1 = Infinity;
        x2 = y2 = -Infinity;
        while (++i < n) {
          p = points[i];
          if (p.x < x1) x1 = p.x;
          if (p.y < y1) y1 = p.y;
          if (p.x > x2) x2 = p.x;
          if (p.y > y2) y2 = p.y;
        }
        var dx = x2 - x1,
          dy = y2 - y1;
        if (dx > dy) y2 = y1 + dx;
        else x2 = x1 + dy;
      }
    function insert(n, p, x1, y1, x2, y2) {
      if (isNaN(p.x) || isNaN(p.y)) return;
      if (n.leaf) {
        var v = n.point;
        if (v)
          if (Math.abs(v.x - p.x) + Math.abs(v.y - p.y) < 0.01)
            insertChild(n, p, x1, y1, x2, y2);
          else {
            n.point = null;
            insertChild(n, v, x1, y1, x2, y2);
            insertChild(n, p, x1, y1, x2, y2);
          }
        else n.point = p;
      } else insertChild(n, p, x1, y1, x2, y2);
    }
    function insertChild(n, p, x1, y1, x2, y2) {
      var sx = (x1 + x2) * 0.5,
        sy = (y1 + y2) * 0.5,
        right = p.x >= sx,
        bottom = p.y >= sy,
        i = (bottom << 1) + right;
      n.leaf = false;
      n = n.nodes[i] || (n.nodes[i] = d3_geom_quadtreeNode());
      if (right) x1 = sx;
      else x2 = sx;
      if (bottom) y1 = sy;
      else y2 = sy;
      insert(n, p, x1, y1, x2, y2);
    }
    var root = d3_geom_quadtreeNode();
    root.add = function (p) {
      insert(root, p, x1, y1, x2, y2);
    };
    root.visit = function (f) {
      d3_geom_quadtreeVisit(f, root, x1, y1, x2, y2);
    };
    points.forEach(root.add);
    return root;
  };
  function d3_geom_quadtreeNode() {
    return { leaf: true, nodes: [], point: null };
  }
  function d3_geom_quadtreeVisit(f, node, x1, y1, x2, y2) {
    if (!f(node, x1, y1, x2, y2)) {
      var sx = (x1 + x2) * 0.5,
        sy = (y1 + y2) * 0.5,
        children = node.nodes;
      if (children[0]) d3_geom_quadtreeVisit(f, children[0], x1, y1, sx, sy);
      if (children[1]) d3_geom_quadtreeVisit(f, children[1], sx, y1, x2, sy);
      if (children[2]) d3_geom_quadtreeVisit(f, children[2], x1, sy, sx, y2);
      if (children[3]) d3_geom_quadtreeVisit(f, children[3], sx, sy, x2, y2);
    }
  }
  function d3_geom_quadtreePoint(p) {
    return { x: p[0], y: p[1] };
  }
  d3.time = {};
  var d3_time = Date;
  function d3_time_utc() {
    this._ = new Date(
      arguments.length > 1 ? Date.UTC.apply(this, arguments) : arguments[0]
    );
  }
  d3_time_utc.prototype = {
    getDate: function () {
      return this._.getUTCDate();
    },
    getDay: function () {
      return this._.getUTCDay();
    },
    getFullYear: function () {
      return this._.getUTCFullYear();
    },
    getHours: function () {
      return this._.getUTCHours();
    },
    getMilliseconds: function () {
      return this._.getUTCMilliseconds();
    },
    getMinutes: function () {
      return this._.getUTCMinutes();
    },
    getMonth: function () {
      return this._.getUTCMonth();
    },
    getSeconds: function () {
      return this._.getUTCSeconds();
    },
    getTime: function () {
      return this._.getTime();
    },
    getTimezoneOffset: function () {
      return 0;
    },
    valueOf: function () {
      return this._.valueOf();
    },
    setDate: function () {
      d3_time_prototype.setUTCDate.apply(this._, arguments);
    },
    setDay: function () {
      d3_time_prototype.setUTCDay.apply(this._, arguments);
    },
    setFullYear: function () {
      d3_time_prototype.setUTCFullYear.apply(this._, arguments);
    },
    setHours: function () {
      d3_time_prototype.setUTCHours.apply(this._, arguments);
    },
    setMilliseconds: function () {
      d3_time_prototype.setUTCMilliseconds.apply(this._, arguments);
    },
    setMinutes: function () {
      d3_time_prototype.setUTCMinutes.apply(this._, arguments);
    },
    setMonth: function () {
      d3_time_prototype.setUTCMonth.apply(this._, arguments);
    },
    setSeconds: function () {
      d3_time_prototype.setUTCSeconds.apply(this._, arguments);
    },
    setTime: function () {
      d3_time_prototype.setTime.apply(this._, arguments);
    },
  };
  var d3_time_prototype = Date.prototype;
  d3.time.format = function (template) {
    var n = template.length;
    function format(date) {
      var string = [],
        i = -1,
        j = 0,
        c,
        f;
      while (++i < n)
        if (template.charCodeAt(i) == 37) {
          string.push(
            template.substring(j, i),
            (f = d3_time_formats[(c = template.charAt(++i))]) ? f(date) : c
          );
          j = i + 1;
        }
      string.push(template.substring(j, i));
      return string.join("");
    }
    format.parse = function (string) {
      var d = { y: 1900, m: 0, d: 1, H: 0, M: 0, S: 0, L: 0 },
        i = d3_time_parse(d, template, string, 0);
      if (i != string.length) return null;
      if ("p" in d) d.H = (d.H % 12) + d.p * 12;
      var date = new d3_time();
      date.setFullYear(d.y, d.m, d.d);
      date.setHours(d.H, d.M, d.S, d.L);
      return date;
    };
    format.toString = function () {
      return template;
    };
    return format;
  };
  function d3_time_parse(date, template, string, j) {
    var c,
      p,
      i = 0,
      n = template.length,
      m = string.length;
    while (i < n) {
      if (j >= m) return -1;
      c = template.charCodeAt(i++);
      if (c == 37) {
        p = d3_time_parsers[template.charAt(i++)];
        if (!p || (j = p(date, string, j)) < 0) return -1;
      } else if (c != string.charCodeAt(j++)) return -1;
    }
    return j;
  }
  var d3_time_zfill2 = d3.format("02d"),
    d3_time_zfill3 = d3.format("03d"),
    d3_time_zfill4 = d3.format("04d"),
    d3_time_sfill2 = d3.format("2d");
  var d3_time_formats = {
    a: function (d) {
      return d3_time_weekdays[d.getDay()].substring(0, 3);
    },
    A: function (d) {
      return d3_time_weekdays[d.getDay()];
    },
    b: function (d) {
      return d3_time_months[d.getMonth()].substring(0, 3);
    },
    B: function (d) {
      return d3_time_months[d.getMonth()];
    },
    c: d3.time.format("%a %b %e %H:%M:%S %Y"),
    d: function (d) {
      return d3_time_zfill2(d.getDate());
    },
    e: function (d) {
      return d3_time_sfill2(d.getDate());
    },
    H: function (d) {
      return d3_time_zfill2(d.getHours());
    },
    I: function (d) {
      return d3_time_zfill2(d.getHours() % 12 || 12);
    },
    j: function (d) {
      return d3_time_zfill3(1 + d3.time.dayOfYear(d));
    },
    L: function (d) {
      return d3_time_zfill3(d.getMilliseconds());
    },
    m: function (d) {
      return d3_time_zfill2(d.getMonth() + 1);
    },
    M: function (d) {
      return d3_time_zfill2(d.getMinutes());
    },
    p: function (d) {
      return d.getHours() >= 12 ? "PM" : "AM";
    },
    S: function (d) {
      return d3_time_zfill2(d.getSeconds());
    },
    U: function (d) {
      return d3_time_zfill2(d3.time.sundayOfYear(d));
    },
    w: function (d) {
      return d.getDay();
    },
    W: function (d) {
      return d3_time_zfill2(d3.time.mondayOfYear(d));
    },
    x: d3.time.format("%m/%d/%y"),
    X: d3.time.format("%H:%M:%S"),
    y: function (d) {
      return d3_time_zfill2(d.getFullYear() % 100);
    },
    Y: function (d) {
      return d3_time_zfill4(d.getFullYear() % 1e4);
    },
    Z: d3_time_zone,
    "%": function (d) {
      return "%";
    },
  };
  var d3_time_parsers = {
    a: d3_time_parseWeekdayAbbrev,
    A: d3_time_parseWeekday,
    b: d3_time_parseMonthAbbrev,
    B: d3_time_parseMonth,
    c: d3_time_parseLocaleFull,
    d: d3_time_parseDay,
    e: d3_time_parseDay,
    H: d3_time_parseHour24,
    I: d3_time_parseHour24,
    L: d3_time_parseMilliseconds,
    m: d3_time_parseMonthNumber,
    M: d3_time_parseMinutes,
    p: d3_time_parseAmPm,
    S: d3_time_parseSeconds,
    x: d3_time_parseLocaleDate,
    X: d3_time_parseLocaleTime,
    y: d3_time_parseYear,
    Y: d3_time_parseFullYear,
  };
  function d3_time_parseWeekdayAbbrev(date, string, i) {
    return d3_time_weekdayAbbrevRe.test(string.substring(i, (i += 3))) ? i : -1;
  }
  function d3_time_parseWeekday(date, string, i) {
    d3_time_weekdayRe.lastIndex = 0;
    var n = d3_time_weekdayRe.exec(string.substring(i, i + 10));
    return n ? (i += n[0].length) : -1;
  }
  var d3_time_weekdayAbbrevRe = /^(?:sun|mon|tue|wed|thu|fri|sat)/i,
    d3_time_weekdayRe =
      /^(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/i,
    d3_time_weekdays = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
  function d3_time_parseMonthAbbrev(date, string, i) {
    var n = d3_time_monthAbbrevLookup.get(
      string.substring(i, (i += 3)).toLowerCase()
    );
    return n == null ? -1 : ((date.m = n), i);
  }
  var d3_time_monthAbbrevLookup = d3.map({
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  });
  function d3_time_parseMonth(date, string, i) {
    d3_time_monthRe.lastIndex = 0;
    var n = d3_time_monthRe.exec(string.substring(i, i + 12));
    return n
      ? ((date.m = d3_time_monthLookup.get(n[0].toLowerCase())),
        (i += n[0].length))
      : -1;
  }
  var d3_time_monthRe =
    /^(?:January|February|March|April|May|June|July|August|September|October|November|December)/gi;
  var d3_time_monthLookup = d3.map({
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  });
  var d3_time_months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  function d3_time_parseLocaleFull(date, string, i) {
    return d3_time_parse(date, d3_time_formats.c.toString(), string, i);
  }
  function d3_time_parseLocaleDate(date, string, i) {
    return d3_time_parse(date, d3_time_formats.x.toString(), string, i);
  }
  function d3_time_parseLocaleTime(date, string, i) {
    return d3_time_parse(date, d3_time_formats.X.toString(), string, i);
  }
  function d3_time_parseFullYear(date, string, i) {
    d3_time_numberRe.lastIndex = 0;
    var n = d3_time_numberRe.exec(string.substring(i, i + 4));
    return n ? ((date.y = +n[0]), (i += n[0].length)) : -1;
  }
  function d3_time_parseYear(date, string, i) {
    d3_time_numberRe.lastIndex = 0;
    var n = d3_time_numberRe.exec(string.substring(i, i + 2));
    return n ? ((date.y = d3_time_century() + +n[0]), (i += n[0].length)) : -1;
  }
  function d3_time_century() {
    return ~~(new Date().getFullYear() / 1e3) * 1e3;
  }
  function d3_time_parseMonthNumber(date, string, i) {
    d3_time_numberRe.lastIndex = 0;
    var n = d3_time_numberRe.exec(string.substring(i, i + 2));
    return n ? ((date.m = n[0] - 1), (i += n[0].length)) : -1;
  }
  function d3_time_parseDay(date, string, i) {
    d3_time_numberRe.lastIndex = 0;
    var n = d3_time_numberRe.exec(string.substring(i, i + 2));
    return n ? ((date.d = +n[0]), (i += n[0].length)) : -1;
  }
  function d3_time_parseHour24(date, string, i) {
    d3_time_numberRe.lastIndex = 0;
    var n = d3_time_numberRe.exec(string.substring(i, i + 2));
    return n ? ((date.H = +n[0]), (i += n[0].length)) : -1;
  }
  function d3_time_parseMinutes(date, string, i) {
    d3_time_numberRe.lastIndex = 0;
    var n = d3_time_numberRe.exec(string.substring(i, i + 2));
    return n ? ((date.M = +n[0]), (i += n[0].length)) : -1;
  }
  function d3_time_parseSeconds(date, string, i) {
    d3_time_numberRe.lastIndex = 0;
    var n = d3_time_numberRe.exec(string.substring(i, i + 2));
    return n ? ((date.S = +n[0]), (i += n[0].length)) : -1;
  }
  function d3_time_parseMilliseconds(date, string, i) {
    d3_time_numberRe.lastIndex = 0;
    var n = d3_time_numberRe.exec(string.substring(i, i + 3));
    return n ? ((date.L = +n[0]), (i += n[0].length)) : -1;
  }
  var d3_time_numberRe = /\s*\d+/;
  function d3_time_parseAmPm(date, string, i) {
    var n = d3_time_amPmLookup.get(string.substring(i, (i += 2)).toLowerCase());
    return n == null ? -1 : ((date.p = n), i);
  }
  var d3_time_amPmLookup = d3.map({ am: 0, pm: 1 });
  function d3_time_zone(d) {
    var z = d.getTimezoneOffset(),
      zs = z > 0 ? "-" : "+",
      zh = ~~(Math.abs(z) / 60),
      zm = Math.abs(z) % 60;
    return zs + d3_time_zfill2(zh) + d3_time_zfill2(zm);
  }
  d3.time.format.utc = function (template) {
    var local = d3.time.format(template);
    function format(date) {
      try {
        d3_time = d3_time_utc;
        var utc = new d3_time();
        utc._ = date;
        return local(utc);
      } finally {
        d3_time = Date;
      }
    }
    format.parse = function (string) {
      try {
        d3_time = d3_time_utc;
        var date = local.parse(string);
        return date && date._;
      } finally {
        d3_time = Date;
      }
    };
    format.toString = local.toString;
    return format;
  };
  var d3_time_formatIso = d3.time.format.utc("%Y-%m-%dT%H:%M:%S.%LZ");
  d3.time.format.iso = Date.prototype.toISOString
    ? d3_time_formatIsoNative
    : d3_time_formatIso;
  function d3_time_formatIsoNative(date) {
    return date.toISOString();
  }
  d3_time_formatIsoNative.parse = function (string) {
    var date = new Date(string);
    return isNaN(date) ? null : date;
  };
  d3_time_formatIsoNative.toString = d3_time_formatIso.toString;
  function d3_time_interval(local, step, number) {
    function round(date) {
      var d0 = local(date),
        d1 = offset(d0, 1);
      return date - d0 < d1 - date ? d0 : d1;
    }
    function ceil(date) {
      step((date = local(new d3_time(date - 1))), 1);
      return date;
    }
    function offset(date, k) {
      step((date = new d3_time(+date)), k);
      return date;
    }
    function range(t0, t1, dt) {
      var time = ceil(t0),
        times = [];
      if (dt > 1)
        while (time < t1) {
          if (!(number(time) % dt)) times.push(new Date(+time));
          step(time, 1);
        }
      else while (time < t1) times.push(new Date(+time)), step(time, 1);
      return times;
    }
    function range_utc(t0, t1, dt) {
      try {
        d3_time = d3_time_utc;
        var utc = new d3_time_utc();
        utc._ = t0;
        return range(utc, t1, dt);
      } finally {
        d3_time = Date;
      }
    }
    local.floor = local;
    local.round = round;
    local.ceil = ceil;
    local.offset = offset;
    local.range = range;
    var utc = (local.utc = d3_time_interval_utc(local));
    utc.floor = utc;
    utc.round = d3_time_interval_utc(round);
    utc.ceil = d3_time_interval_utc(ceil);
    utc.offset = d3_time_interval_utc(offset);
    utc.range = range_utc;
    return local;
  }
  function d3_time_interval_utc(method) {
    return function (date, k) {
      try {
        d3_time = d3_time_utc;
        var utc = new d3_time_utc();
        utc._ = date;
        return method(utc, k)._;
      } finally {
        d3_time = Date;
      }
    };
  }
  d3.time.second = d3_time_interval(
    function (date) {
      return new d3_time(Math.floor(date / 1e3) * 1e3);
    },
    function (date, offset) {
      date.setTime(date.getTime() + Math.floor(offset) * 1e3);
    },
    function (date) {
      return date.getSeconds();
    }
  );
  d3.time.seconds = d3.time.second.range;
  d3.time.seconds.utc = d3.time.second.utc.range;
  d3.time.minute = d3_time_interval(
    function (date) {
      return new d3_time(Math.floor(date / 6e4) * 6e4);
    },
    function (date, offset) {
      date.setTime(date.getTime() + Math.floor(offset) * 6e4);
    },
    function (date) {
      return date.getMinutes();
    }
  );
  d3.time.minutes = d3.time.minute.range;
  d3.time.minutes.utc = d3.time.minute.utc.range;
  d3.time.hour = d3_time_interval(
    function (date) {
      var timezone = date.getTimezoneOffset() / 60;
      return new d3_time(
        (Math.floor(date / 36e5 - timezone) + timezone) * 36e5
      );
    },
    function (date, offset) {
      date.setTime(date.getTime() + Math.floor(offset) * 36e5);
    },
    function (date) {
      return date.getHours();
    }
  );
  d3.time.hours = d3.time.hour.range;
  d3.time.hours.utc = d3.time.hour.utc.range;
  d3.time.day = d3_time_interval(
    function (date) {
      return new d3_time(date.getFullYear(), date.getMonth(), date.getDate());
    },
    function (date, offset) {
      date.setDate(date.getDate() + offset);
    },
    function (date) {
      return date.getDate() - 1;
    }
  );
  d3.time.days = d3.time.day.range;
  d3.time.days.utc = d3.time.day.utc.range;
  d3.time.dayOfYear = function (date) {
    var year = d3.time.year(date);
    return Math.floor(
      (date - year) / 864e5 -
        (date.getTimezoneOffset() - year.getTimezoneOffset()) / 1440
    );
  };
  d3_time_weekdays.forEach(function (day, i) {
    day = day.toLowerCase();
    i = 7 - i;
    var interval = (d3.time[day] = d3_time_interval(
      function (date) {
        (date = d3.time.day(date)).setDate(
          date.getDate() - ((date.getDay() + i) % 7)
        );
        return date;
      },
      function (date, offset) {
        date.setDate(date.getDate() + Math.floor(offset) * 7);
      },
      function (date) {
        var day = d3.time.year(date).getDay();
        return (
          Math.floor((d3.time.dayOfYear(date) + ((day + i) % 7)) / 7) -
          (day !== i)
        );
      }
    ));
    d3.time[day + "s"] = interval.range;
    d3.time[day + "s"].utc = interval.utc.range;
    d3.time[day + "OfYear"] = function (date) {
      var day = d3.time.year(date).getDay();
      return Math.floor((d3.time.dayOfYear(date) + ((day + i) % 7)) / 7);
    };
  });
  d3.time.week = d3.time.sunday;
  d3.time.weeks = d3.time.sunday.range;
  d3.time.weeks.utc = d3.time.sunday.utc.range;
  d3.time.weekOfYear = d3.time.sundayOfYear;
  d3.time.month = d3_time_interval(
    function (date) {
      return new d3_time(date.getFullYear(), date.getMonth(), 1);
    },
    function (date, offset) {
      date.setMonth(date.getMonth() + offset);
    },
    function (date) {
      return date.getMonth();
    }
  );
  d3.time.months = d3.time.month.range;
  d3.time.months.utc = d3.time.month.utc.range;
  d3.time.year = d3_time_interval(
    function (date) {
      return new d3_time(date.getFullYear(), 0, 1);
    },
    function (date, offset) {
      date.setFullYear(date.getFullYear() + offset);
    },
    function (date) {
      return date.getFullYear();
    }
  );
  d3.time.years = d3.time.year.range;
  d3.time.years.utc = d3.time.year.utc.range;
  function d3_time_scale(linear, methods, format) {
    function scale(x) {
      return linear(x);
    }
    scale.invert = function (x) {
      return d3_time_scaleDate(linear.invert(x));
    };
    scale.domain = function (x) {
      if (!arguments.length) return linear.domain().map(d3_time_scaleDate);
      linear.domain(x);
      return scale;
    };
    scale.nice = function (m) {
      var extent = d3_time_scaleExtent(scale.domain());
      return scale.domain([m.floor(extent[0]), m.ceil(extent[1])]);
    };
    scale.ticks = function (m, k) {
      var extent = d3_time_scaleExtent(scale.domain());
      if (typeof m !== "function") {
        var span = extent[1] - extent[0],
          target = span / m,
          i = d3.bisect(d3_time_scaleSteps, target);
        if (i == d3_time_scaleSteps.length) return methods.year(extent, m);
        if (!i) return linear.ticks(m).map(d3_time_scaleDate);
        if (
          Math.log(target / d3_time_scaleSteps[i - 1]) <
          Math.log(d3_time_scaleSteps[i] / target)
        )
          --i;
        m = methods[i];
        k = m[1];
        m = m[0].range;
      }
      return m(extent[0], new Date(+extent[1] + 1), k);
    };
    scale.tickFormat = function () {
      return format;
    };
    scale.copy = function () {
      return d3_time_scale(linear.copy(), methods, format);
    };
    return d3.rebind(
      scale,
      linear,
      "range",
      "rangeRound",
      "interpolate",
      "clamp"
    );
  }
  function d3_time_scaleExtent(domain) {
    var start = domain[0],
      stop = domain[domain.length - 1];
    return start < stop ? [start, stop] : [stop, start];
  }
  function d3_time_scaleDate(t) {
    return new Date(t);
  }
  function d3_time_scaleFormat(formats) {
    return function (date) {
      var i = formats.length - 1,
        f = formats[i];
      while (!f[1](date)) f = formats[--i];
      return f[0](date);
    };
  }
  function d3_time_scaleSetYear(y) {
    var d = new Date(y, 0, 1);
    d.setFullYear(y);
    return d;
  }
  function d3_time_scaleGetYear(d) {
    var y = d.getFullYear(),
      d0 = d3_time_scaleSetYear(y),
      d1 = d3_time_scaleSetYear(y + 1);
    return y + (d - d0) / (d1 - d0);
  }
  var d3_time_scaleSteps = [
    1e3, 5e3, 15e3, 3e4, 6e4, 3e5, 9e5, 18e5, 36e5, 108e5, 216e5, 432e5, 864e5,
    1728e5, 6048e5, 2592e6, 7776e6, 31536e6,
  ];
  var d3_time_scaleLocalMethods = [
    [d3.time.second, 1],
    [d3.time.second, 5],
    [d3.time.second, 15],
    [d3.time.second, 30],
    [d3.time.minute, 1],
    [d3.time.minute, 5],
    [d3.time.minute, 15],
    [d3.time.minute, 30],
    [d3.time.hour, 1],
    [d3.time.hour, 3],
    [d3.time.hour, 6],
    [d3.time.hour, 12],
    [d3.time.day, 1],
    [d3.time.day, 2],
    [d3.time.week, 1],
    [d3.time.month, 1],
    [d3.time.month, 3],
    [d3.time.year, 1],
  ];
  var d3_time_scaleLocalFormats = [
    [
      d3.time.format("%Y"),
      function (d) {
        return true;
      },
    ],
    [
      d3.time.format("%B"),
      function (d) {
        return d.getMonth();
      },
    ],
    [
      d3.time.format("%b %d"),
      function (d) {
        return d.getDate() != 1;
      },
    ],
    [
      d3.time.format("%a %d"),
      function (d) {
        return d.getDay() && d.getDate() != 1;
      },
    ],
    [
      d3.time.format("%I %p"),
      function (d) {
        return d.getHours();
      },
    ],
    [
      d3.time.format("%I:%M"),
      function (d) {
        return d.getMinutes();
      },
    ],
    [
      d3.time.format(":%S"),
      function (d) {
        return d.getSeconds();
      },
    ],
    [
      d3.time.format(".%L"),
      function (d) {
        return d.getMilliseconds();
      },
    ],
  ];
  var d3_time_scaleLinear = d3.scale.linear(),
    d3_time_scaleLocalFormat = d3_time_scaleFormat(d3_time_scaleLocalFormats);
  d3_time_scaleLocalMethods.year = function (extent, m) {
    return d3_time_scaleLinear
      .domain(extent.map(d3_time_scaleGetYear))
      .ticks(m)
      .map(d3_time_scaleSetYear);
  };
  d3.time.scale = function () {
    return d3_time_scale(
      d3.scale.linear(),
      d3_time_scaleLocalMethods,
      d3_time_scaleLocalFormat
    );
  };
  var d3_time_scaleUTCMethods = d3_time_scaleLocalMethods.map(function (m) {
    return [m[0].utc, m[1]];
  });
  var d3_time_scaleUTCFormats = [
    [
      d3.time.format.utc("%Y"),
      function (d) {
        return true;
      },
    ],
    [
      d3.time.format.utc("%B"),
      function (d) {
        return d.getUTCMonth();
      },
    ],
    [
      d3.time.format.utc("%b %d"),
      function (d) {
        return d.getUTCDate() != 1;
      },
    ],
    [
      d3.time.format.utc("%a %d"),
      function (d) {
        return d.getUTCDay() && d.getUTCDate() != 1;
      },
    ],
    [
      d3.time.format.utc("%I %p"),
      function (d) {
        return d.getUTCHours();
      },
    ],
    [
      d3.time.format.utc("%I:%M"),
      function (d) {
        return d.getUTCMinutes();
      },
    ],
    [
      d3.time.format.utc(":%S"),
      function (d) {
        return d.getUTCSeconds();
      },
    ],
    [
      d3.time.format.utc(".%L"),
      function (d) {
        return d.getUTCMilliseconds();
      },
    ],
  ];
  var d3_time_scaleUTCFormat = d3_time_scaleFormat(d3_time_scaleUTCFormats);
  function d3_time_scaleUTCSetYear(y) {
    var d = new Date(Date.UTC(y, 0, 1));
    d.setUTCFullYear(y);
    return d;
  }
  function d3_time_scaleUTCGetYear(d) {
    var y = d.getUTCFullYear(),
      d0 = d3_time_scaleUTCSetYear(y),
      d1 = d3_time_scaleUTCSetYear(y + 1);
    return y + (d - d0) / (d1 - d0);
  }
  d3_time_scaleUTCMethods.year = function (extent, m) {
    return d3_time_scaleLinear
      .domain(extent.map(d3_time_scaleUTCGetYear))
      .ticks(m)
      .map(d3_time_scaleUTCSetYear);
  };
  d3.time.scale.utc = function () {
    return d3_time_scale(
      d3.scale.linear(),
      d3_time_scaleUTCMethods,
      d3_time_scaleUTCFormat
    );
  };
})();
window.OrbitDiagram = (function () {
  function OrbitDiagram(selector, options) {
    this.$e = $(selector);
    this.selector = selector;
    this.orbit_svg = null;
    options = options || {};
    this.DIAGRAM_HEIGHT = options.diagram_height || 170;
    this.DIAGRAM_WIDTH = options.diagram_width || 300;
    this.SUN_X = options.sun_x || this.DIAGRAM_WIDTH / 2;
    this.SUN_Y = options.sun_y || this.DIAGRAM_HEIGHT / 2 - 10;
    this.DIAGRAM_AU_FACTOR = options.diagram_au_factor || 50;
  }
  OrbitDiagram.prototype.prepareRender = function () {
    this.$e.empty();
    this.orbit_svg = d3
      .select(this.selector)
      .append("svg:svg")
      .attr("width", this.DIAGRAM_WIDTH)
      .attr("height", this.DIAGRAM_HEIGHT);
    this.plotSun();
  };
  OrbitDiagram.prototype.renderPlanets = function () {
    this.plotEarth();
    this.plotVenus();
    this.plotMercury();
    this.plotMars();
  };
  OrbitDiagram.prototype.render = function (a, e, w) {
    this.prepareRender();
    this.renderPlanets();
    return this.renderAnother(a, e, w);
  };
  OrbitDiagram.prototype.renderAnother = function (a, e, w) {
    return this.plotOrbit(a, e, w, "white");
  };
  OrbitDiagram.prototype.plotOrbit = function (a, e, w, color) {
    var sqrtme = 1 - e * e;
    var b = a * Math.sqrt(Math.max(0, sqrtme));
    var f = a * e;
    var rx = b * this.DIAGRAM_AU_FACTOR;
    var ry = Math.abs(a * this.DIAGRAM_AU_FACTOR);
    var foci = f * this.DIAGRAM_AU_FACTOR;
    return this.plotCoords(rx, ry, foci, w, color);
  };
  OrbitDiagram.prototype.plotCoords = function (rx, ry, f, rotate_deg, color) {
    color = color || "white";
    var cx = this.SUN_X;
    var cy = this.SUN_Y + f;
    return this.orbit_svg
      .append("svg:ellipse")
      .style("stroke", color)
      .style("fill", "none")
      .attr("rx", rx)
      .attr("ry", ry)
      .attr("cx", cx)
      .attr("cy", cy)
      .attr(
        "transform",
        "rotate(" + rotate_deg + ", " + this.SUN_X + ", " + this.SUN_Y + ")"
      );
  };
  OrbitDiagram.prototype.plotSun = function () {
    this.orbit_svg
      .append("svg:ellipse")
      .style("stroke", "yellow")
      .style("fill", "yellow")
      .attr("rx", 2)
      .attr("ry", 2)
      .attr("cx", this.SUN_X)
      .attr("cy", this.SUN_Y);
  };
  OrbitDiagram.prototype.plotEarth = function () {
    this.plotOrbit(1.00000011, 0.01671022, 102.93768193, "cyan");
  };
  OrbitDiagram.prototype.plotJupiter = function () {
    this.plotOrbit(5.20336301, 0.04839266, 14.72847983, "orange");
  };
  OrbitDiagram.prototype.plotMars = function () {
    this.plotOrbit(1.52366231, 0.0935, 336.04084, "red");
  };
  OrbitDiagram.prototype.plotVenus = function () {
    this.plotOrbit(0.72333199, 0.00677323, 131.60246718, "orange");
  };
  OrbitDiagram.prototype.plotMercury = function () {
    this.plotOrbit(0.38709893, 0.20563069, 77.45779628, "purple");
  };
  return OrbitDiagram;
})();
function SimpleCache(hash_fn) {
  var me = this;
  hash_fn =
    hash_fn ||
    function (x) {
      return x;
    };
  var cache = {};
  me.Get = function (key) {
    var result = cache[hash_fn(key)];
    return result ? result : false;
  };
  me.Set = function (key, val) {
    cache[hash_fn(key)] = val;
  };
}
if (!Object.keys)
  Object.keys = (function () {
    var hasOwnProperty = Object.prototype.hasOwnProperty,
      hasDontEnumBug = !{ toString: null }.propertyIsEnumerable("toString"),
      dontEnums = [
        "toString",
        "toLocaleString",
        "valueOf",
        "hasOwnProperty",
        "isPrototypeOf",
        "propertyIsEnumerable",
        "constructor",
      ],
      dontEnumsLength = dontEnums.length;
    return function (obj) {
      if (
        (typeof obj !== "object" && typeof obj !== "function") ||
        obj === null
      )
        throw new TypeError("Object.keys called on non-object");
      var result = [];
      for (var prop in obj)
        if (hasOwnProperty.call(obj, prop)) result.push(prop);
      if (hasDontEnumBug)
        for (var i = 0; i < dontEnumsLength; i++)
          if (hasOwnProperty.call(obj, dontEnums[i])) result.push(dontEnums[i]);
      return result;
    };
  })();
function getURLParameter(name) {
  return (
    decodeURIComponent(
      (new RegExp("[?|&]" + name + "=" + "([^&;]+?)(&|#|;|$)").exec(
        location.search
      ) || [, ""])[1].replace(/\+/g, "%20")
    ) || null
  );
}
(function () {
  var fuzzes = [
    { word: "trillion", num: 1e12 },
    { word: "billion", num: 1e9 },
    { word: "million", num: 1e6 },
  ];
  function toFuzz(n) {
    if (n < 0.1) return 0;
    for (var i = 0; i < fuzzes.length; i++) {
      var x = fuzzes[i];
      if (n / x.num >= 1) {
        var prefix = n / x.num;
        if (i == 0 && prefix > 100) return ">100 " + x.word;
        return prefix.toFixed(2) + " " + x.word;
      }
    }
    return n;
  }
  function truncateText(txt, len) {
    if (txt.length > len) txt = txt.substring(0, len - 3) + "...";
    return txt;
  }
  function sizeContainers() {
    var $tc = $("#top-container");
    var $bc = $("#bottom-container");
    var wh = $(window).height();
    var tch = wh / 2 - $tc.offset().top - 25;
    $tc.height(tch);
    var bch = wh - $tc.height() - $tc.offset().top - 25;
    $bc.height(bch);
    var $rs = $("#right-side");
    var $ls = $("#left-side");
    var ww = $(window).width();
    $("#webgl-container").height(bch).width(ww);
    $ls.width(ww * 0.3);
    $rs.width(ww - $ls.width() - 75);
    $rs.height(tch);
    $ls.height(tch);
    $("#results-table-container").height($ls.height() - 15);
  }
  sizeContainers();
  $(window).on("resize", function () {
    sizeContainers();
  });
  var mod = angular
    .module("AsterankApp", ["filters", "ui.bootstrap"])
    .config(function ($interpolateProvider) {
      $interpolateProvider.startSymbol("[[").endSymbol("]]");
    });
  angular
    .module("filters", [])
    .filter("fuzzynum", function () {
      return function (num) {
        return toFuzz(num);
      };
    })
    .filter("truncate", function () {
      return function (txt) {
        return truncateText(txt);
      };
    })
    .filter("ifempty", function () {
      return function (s1, s2) {
        if (!s1) return s2;
        return s1;
      };
    });
  mod.factory("pubsub", function () {
    var cache = {};
    return {
      publish: function (topic, args) {
        cache[topic] &&
          $.each(cache[topic], function () {
            this.apply(null, args || []);
          });
      },
      subscribe: function (topic, callback) {
        if (!cache[topic]) cache[topic] = [];
        cache[topic].push(callback);
        return [topic, callback];
      },
      unsubscribe: function (handle) {
        var t = handle[0];
        cache[t] &&
          d.each(cache[t], function (idx) {
            if (this == handle[1]) cache[t].splice(idx, 1);
          });
      },
    };
  });
  mod.directive("autocomplete", function () {
    return {
      restrict: "A",
      replace: true,
      transclude: true,
      template:
        '<div style="display:inline"><input class="input" type="text" placeholder="eg. 433 Eros" style="height:15px;font-size:12px;"/>' +
        '<div id="asteroid-lookup-suggestions"></div></div>',
      link: function ($scope, element, attrs) {
        var $el = $(element).find("input");
        $el.autocomplete({
          minChars: 3,
          serviceUrl: "/asterank/api/autocomplete",
          paramName: "query",
          transformResult: function (resp) {
            return $.map(resp, function (item) {
              return { value: item.full_name, data: item };
            });
          },
          onSelect: function (suggestion) {
            $scope.Lookup(suggestion);
          },
          appendTo: "#asteroid-lookup-suggestions",
        });
      },
    };
  });
})();
angular.module("ui.bootstrap", ["ui.bootstrap.tpls", "ui.bootstrap.modal"]);
angular.module("ui.bootstrap.tpls", []);
angular
  .module("ui.bootstrap.modal", ["ui.bootstrap.dialog"])
  .directive("modal", [
    "$parse",
    "$dialog",
    function ($parse, $dialog) {
      return {
        restrict: "EA",
        terminal: true,
        link: function (scope, elm, attrs) {
          var opts = angular.extend(
            {},
            scope.$eval(attrs.uiOptions || attrs.bsOptions || attrs.options)
          );
          var shownExpr = attrs.modal || attrs.show;
          var setClosed;
          opts = angular.extend(opts, {
            template: elm.html(),
            resolve: {
              $scope: function () {
                return scope;
              },
            },
          });
          var dialog = $dialog.dialog(opts);
          elm.remove();
          if (attrs.close)
            setClosed = function () {
              $parse(attrs.close)(scope);
            };
          else
            setClosed = function () {
              if (angular.isFunction($parse(shownExpr).assign))
                $parse(shownExpr).assign(scope, false);
            };
          scope.$watch(shownExpr, function (isShown, oldShown) {
            if (isShown)
              dialog.open().then(function () {
                setClosed();
              });
            else if (dialog.isOpen()) dialog.close();
          });
        },
      };
    },
  ]);
var dialogModule = angular.module("ui.bootstrap.dialog", [
  "ui.bootstrap.transition",
]);
dialogModule.controller("MessageBoxController", [
  "$scope",
  "dialog",
  "model",
  function ($scope, dialog, model) {
    $scope.title = model.title;
    $scope.message = model.message;
    $scope.buttons = model.buttons;
    $scope.close = function (res) {
      dialog.close(res);
    };
  },
]);
dialogModule.provider("$dialog", function () {
  var defaults = {
    backdrop: true,
    dialogClass: "modal",
    backdropClass: "modal-backdrop",
    transitionClass: "fade",
    triggerClass: "in",
    dialogOpenClass: "modal-open",
    resolve: {},
    backdropFade: false,
    dialogFade: false,
    keyboard: true,
    backdropClick: true,
  };
  var globalOptions = {};
  var activeBackdrops = { value: 0 };
  this.options = function (value) {
    globalOptions = value;
  };
  this.$get = [
    "$http",
    "$document",
    "$compile",
    "$rootScope",
    "$controller",
    "$templateCache",
    "$q",
    "$transition",
    "$injector",
    function (
      $http,
      $document,
      $compile,
      $rootScope,
      $controller,
      $templateCache,
      $q,
      $transition,
      $injector
    ) {
      var body = $document.find("body");
      function createElement(clazz) {
        var el = angular.element("<div>");
        el.addClass(clazz);
        return el;
      }
      function Dialog(opts) {
        var self = this,
          options = (this.options = angular.extend(
            {},
            defaults,
            globalOptions,
            opts
          ));
        this._open = false;
        this.backdropEl = createElement(options.backdropClass);
        if (options.backdropFade) {
          this.backdropEl.addClass(options.transitionClass);
          this.backdropEl.removeClass(options.triggerClass);
        }
        this.modalEl = createElement(options.dialogClass);
        if (options.dialogFade) {
          this.modalEl.addClass(options.transitionClass);
          this.modalEl.removeClass(options.triggerClass);
        }
        this.handledEscapeKey = function (e) {
          if (e.which === 27) {
            self.close();
            e.preventDefault();
            self.$scope.$apply();
          }
        };
        this.handleBackDropClick = function (e) {
          self.close();
          e.preventDefault();
          self.$scope.$apply();
        };
      }
      Dialog.prototype.isOpen = function () {
        return this._open;
      };
      Dialog.prototype.open = function (templateUrl, controller) {
        var self = this,
          options = this.options;
        if (templateUrl) options.templateUrl = templateUrl;
        if (controller) options.controller = controller;
        if (!(options.template || options.templateUrl))
          throw new Error(
            "Dialog.open expected template or templateUrl, neither found. Use options or open method to specify them."
          );
        this._loadResolves().then(function (locals) {
          var $scope =
            (locals.$scope =
            self.$scope =
              locals.$scope ? locals.$scope : $rootScope.$new());
          self.modalEl.html(locals.$template);
          if (self.options.controller) {
            var ctrl = $controller(self.options.controller, locals);
            self.modalEl.contents().data("ngControllerController", ctrl);
          }
          $compile(self.modalEl)($scope);
          self._addElementsToDom();
          body.addClass(self.options.dialogOpenClass);
          setTimeout(function () {
            if (self.options.dialogFade)
              self.modalEl.addClass(self.options.triggerClass);
            if (self.options.backdropFade)
              self.backdropEl.addClass(self.options.triggerClass);
          });
          self._bindEvents();
        });
        this.deferred = $q.defer();
        return this.deferred.promise;
      };
      Dialog.prototype.close = function (result) {
        var self = this;
        var fadingElements = this._getFadingElements();
        body.removeClass(self.options.dialogOpenClass);
        if (fadingElements.length > 0) {
          for (var i = fadingElements.length - 1; i >= 0; i--)
            $transition(fadingElements[i], removeTriggerClass).then(
              onCloseComplete
            );
          return;
        }
        this._onCloseComplete(result);
        function removeTriggerClass(el) {
          el.removeClass(self.options.triggerClass);
        }
        function onCloseComplete() {
          if (self._open) self._onCloseComplete(result);
        }
      };
      Dialog.prototype._getFadingElements = function () {
        var elements = [];
        if (this.options.dialogFade) elements.push(this.modalEl);
        if (this.options.backdropFade) elements.push(this.backdropEl);
        return elements;
      };
      Dialog.prototype._bindEvents = function () {
        if (this.options.keyboard) body.bind("keydown", this.handledEscapeKey);
        if (this.options.backdrop && this.options.backdropClick)
          this.backdropEl.bind("click", this.handleBackDropClick);
      };
      Dialog.prototype._unbindEvents = function () {
        if (this.options.keyboard)
          body.unbind("keydown", this.handledEscapeKey);
        if (this.options.backdrop && this.options.backdropClick)
          this.backdropEl.unbind("click", this.handleBackDropClick);
      };
      Dialog.prototype._onCloseComplete = function (result) {
        this._removeElementsFromDom();
        this._unbindEvents();
        this.deferred.resolve(result);
      };
      Dialog.prototype._addElementsToDom = function () {
        body.append(this.modalEl);
        if (this.options.backdrop) {
          if (activeBackdrops.value === 0) body.append(this.backdropEl);
          activeBackdrops.value++;
        }
        this._open = true;
      };
      Dialog.prototype._removeElementsFromDom = function () {
        this.modalEl.remove();
        if (this.options.backdrop) {
          activeBackdrops.value--;
          if (activeBackdrops.value === 0) this.backdropEl.remove();
        }
        this._open = false;
      };
      Dialog.prototype._loadResolves = function () {
        var values = [],
          keys = [],
          templatePromise,
          self = this;
        if (this.options.template)
          templatePromise = $q.when(this.options.template);
        else if (this.options.templateUrl)
          templatePromise = $http
            .get(this.options.templateUrl, { cache: $templateCache })
            .then(function (response) {
              return response.data;
            });
        angular.forEach(this.options.resolve || [], function (value, key) {
          keys.push(key);
          values.push(
            angular.isString(value)
              ? $injector.get(value)
              : $injector.invoke(value)
          );
        });
        keys.push("$template");
        values.push(templatePromise);
        return $q.all(values).then(function (values) {
          var locals = {};
          angular.forEach(values, function (value, index) {
            locals[keys[index]] = value;
          });
          locals.dialog = self;
          return locals;
        });
      };
      return {
        dialog: function (opts) {
          return new Dialog(opts);
        },
        messageBox: function (title, message, buttons) {
          return new Dialog({
            templateUrl: "template/dialog/message.html",
            controller: "MessageBoxController",
            resolve: {
              model: function () {
                return { title: title, message: message, buttons: buttons };
              },
            },
          });
        },
      };
    },
  ];
});
angular.module("ui.bootstrap.transition", []).factory("$transition", [
  "$q",
  "$timeout",
  "$rootScope",
  function ($q, $timeout, $rootScope) {
    var $transition = function (element, trigger, options) {
      options = options || {};
      var deferred = $q.defer();
      var endEventName =
        $transition[
          options.animation ? "animationEndEventName" : "transitionEndEventName"
        ];
      var transitionEndHandler = function (event) {
        $rootScope.$apply(function () {
          element.unbind(endEventName, transitionEndHandler);
          deferred.resolve(element);
        });
      };
      if (endEventName) element.bind(endEventName, transitionEndHandler);
      $timeout(function () {
        if (angular.isString(trigger)) element.addClass(trigger);
        else if (angular.isFunction(trigger)) trigger(element);
        else if (angular.isObject(trigger)) element.css(trigger);
        if (!endEventName) deferred.resolve(element);
      });
      deferred.promise.cancel = function () {
        if (endEventName) element.unbind(endEventName, transitionEndHandler);
        deferred.reject("Transition cancelled");
      };
      return deferred.promise;
    };
    var transElement = document.createElement("trans");
    var transitionEndEventNames = {
      WebkitTransition: "webkitTransitionEnd",
      MozTransition: "transitionend",
      OTransition: "oTransitionEnd",
      transition: "transitionend",
    };
    var animationEndEventNames = {
      WebkitTransition: "webkitAnimationEnd",
      MozTransition: "animationend",
      OTransition: "oAnimationEnd",
      transition: "animationend",
    };
    function findEndEventName(endEventNames) {
      for (var name in endEventNames)
        if (transElement.style[name] !== undefined) return endEventNames[name];
    }
    $transition.transitionEndEventName = findEndEventName(
      transitionEndEventNames
    );
    $transition.animationEndEventName = findEndEventName(
      animationEndEventNames
    );
    return $transition;
  },
]);
angular.module("template/dialog/message.html", []).run([
  "$templateCache",
  function ($templateCache) {
    $templateCache.put(
      "template/dialog/message.html",
      '<div class="modal-header">' +
        "\t<h1>{{ title }}</h1>" +
        "</div>" +
        '<div class="modal-body">' +
        "\t<p>{{ message }}</p>" +
        "</div>" +
        '<div class="modal-footer">' +
        '\t<button ng-repeat="btn in buttons" ng-click="close(btn.result)" class=btn ng-class="btn.cssClass">{{ btn.label }}</button>' +
        "</div>" +
        ""
    );
  },
]);
function Asterank3DCtrl($scope, pubsub) {
  $scope.running = true;
  $scope.Init = function () {
    asterank3d = new Asterank3D({
      container: document.getElementById("webgl-container"),
      not_supported_callback: function () {
        if (typeof mixpanel !== "undefined") mixpanel.track("not supported");
        $("#webgl-not-supported").show();
        var $tc = $("#top-container");
        var $bc = $("#bottom-container");
        $tc.height($tc.height() + ($bc.height() - 250));
        $bc.height(250);
        var $rs = $("#right-side");
        var $ls = $("#left-side");
        $("#results-table-container").height($rs.height() + 250);
        $rs.height($rs.height() + 250);
        $ls.height($ls.height() + 250);
      },
      top_object_color: 16777215,
    });
  };
  $scope.SunView = function () {
    asterank3d.clearLock();
  };
  $scope.EarthView = function () {
    asterank3d.setLock("earth");
  };
  $scope.Pause = function () {
    asterank3d.pause();
    $scope.running = false;
  };
  $scope.Play = function () {
    asterank3d.play();
    $scope.running = true;
  };
  $scope.FullView = function () {
    window.location.href = "http://asterank.com/3d";
  };
  pubsub.subscribe("Lock3DView", function (asteroid) {
    asterank3d.setLock(asteroid.full_name);
  });
  pubsub.subscribe("NewAsteroidRanking", function (rankings) {
    asterank3d.clearRankings();
    asterank3d.processAsteroidRankings(rankings);
  });
  pubsub.subscribe("Default3DView", function () {
    asterank3d.clearLock();
  });
}
function AsteroidDetailsCtrl($scope, $http, pubsub) {
  var MPC_FIELDS_TO_INCLUDE = {
    e: { name: "Eccentricity" },
    epoch: { name: "Epoch" },
    dv: { name: "Delta-v", units: "km/s" },
    diameter: { name: "Diameter", units: "km" },
    ma: { name: "Mean Anomaly", units: "deg @ epoch" },
    om: { name: "Longitude of Ascending Node", units: "deg @ J2000" },
    w: { name: "Argument of Perihelion", units: "deg @ J2000" },
  };
  $scope.asteroid = null;
  $scope.asteroid_details = null;
  $scope.Init = function () {
    $scope.ResetView();
  };
  $scope.ResetView = function () {
    $scope.showing_stats = [];
    $scope.approaches = [];
    $scope.composition = [];
    $scope.images = [];
    $scope.images_loading = true;
    $scope.blinkData = { currentImage: 0 };
    $scope.stopBlinking();
  };
  var jpl_cache = new SimpleCache();
  var compositions_map = null;
  var blinkInterval = undefined;
  $scope.startBlinking = function startBlinkings() {
    $scope.stopBlinking();
    $scope.blinkData.blinkingNow = true;
    blinkInterval = setInterval(function () {
      $scope.$apply($scope.nextImage);
    }, 1e3);
  };
  $scope.stopBlinking = function stopBlinking() {
    if (blinkInterval) clearInterval(blinkInterval);
    $scope.blinkData.blinkingNow = false;
    blinkInterval = undefined;
  };
  $scope.checkAll = function checkAll(value) {
    var images = $scope.images;
    value = !!value;
    for (var i in images)
      if (images.hasOwnProperty(i)) images[i].checked = value;
  };
  $scope.nextImage = function nextImage() {
    changeImage(forwardDirection);
  };
  $scope.prevImage = function prevImage() {
    changeImage(backwardDirection);
  };
  function forwardDirection(currentImage, n) {
    return (currentImage + 1) % n;
  }
  function backwardDirection(currentImage, n) {
    return (currentImage - 1 + n) % n;
  }
  function changeImage(directionFn) {
    var images = $scope.images;
    var i = 0,
      n = images.length;
    var currentImage = $scope.blinkData.currentImage | 0;
    do {
      currentImage = directionFn(currentImage, n);
      i++;
    } while (!images[currentImage].checked && i < n);
    $scope.blinkData.currentImage = currentImage;
  }
  pubsub.subscribe("AsteroidDetailsClick", function (asteroid) {
    if ($scope.asteroid && asteroid.full_name === $scope.asteroid.full_name) {
      $scope.asteroid = null;
      $scope.ResetView();
      pubsub.publish("ShowIntroStatement");
      pubsub.publish("Default3DView");
      return;
    }
    $scope.asteroid = asteroid;
    $scope.ResetView();
    $scope.stats = [];
    pubsub.publish("HideIntroStatement");
    var query = $scope.asteroid.prov_des || $scope.asteroid.full_name;
    var cache_result = jpl_cache.Get(query);
    if (cache_result) ShowData(cache_result);
    else
      $http.get("/asterank/jpl/lookup?query=" + query).success(function (data) {
        ShowData(data);
        jpl_cache.Set($scope.asteroid.full_name, data);
      });
    ShowOrbitalDiagram();
    pubsub.publish("Lock3DView", [asteroid]);
  });
  function ShowData(data) {
    for (var attr in data) {
      if (!data.hasOwnProperty(attr)) continue;
      if (typeof data[attr] !== "object")
        if (data[attr] != -1)
          $scope.stats.push({
            name: attr.replace(/(.*?)\(.*?\)/, "$1"),
            units: attr.replace(/.*?\((.*?)\)/, "$1"),
            value: data[attr],
          });
    }
    for (var attr in MPC_FIELDS_TO_INCLUDE) {
      if (!MPC_FIELDS_TO_INCLUDE.hasOwnProperty(attr)) continue;
      var val = MPC_FIELDS_TO_INCLUDE[attr];
      $scope.stats.push({
        name: attr,
        units: val.units,
        value: $scope.asteroid[attr],
      });
    }
    $scope.approaches = data["Close Approaches"];
    if ($scope.asteroid.custom_object) {
      $scope.images = [];
      $scope.images_loading = false;
    } else {
      if (compositions_map)
        $scope.composition = Object.keys(
          compositions_map[$scope.asteroid.spec]
        );
      else if ($scope.asteroid.spec)
        $http.get("/asterank/api/compositions").success(function (data) {
          var compositions_map = data;
          $scope.composition = Object.keys(
            compositions_map[$scope.asteroid.spec]
          );
        });
      var imagery_req_url =
        "/asterank/api/skymorph/images_for?target=" + $scope.asteroid.prov_des;
      var requesting_images_for = $scope.asteroid.prov_des;
      $http.get(imagery_req_url).success(function (data) {
        if ($scope.asteroid.prov_des == requesting_images_for) {
          $scope.images = data.images;
          $scope.images_loading = false;
          $scope.checkAll(true);
        }
      });
    }
  }
  function ShowOrbitalDiagram() {
    var orbit_diagram = new OrbitDiagram("#orbit-2d-diagram", {});
    orbit_diagram.render(
      $scope.asteroid.a,
      $scope.asteroid.e,
      $scope.asteroid.w
    );
  }
}
function AsteroidLookupCtrl($scope, $http, pubsub) {
  var PRESELECT_URL_PARAM = "object";
  $scope.lookup_query = "";
  $scope.Init = function () {
    var preselected = getURLParameter(PRESELECT_URL_PARAM);
    if (preselected) {
      $scope.autocomplete_default_text = preselected;
      $http
        .get("/asterank/api/autocomplete?query=" + preselected)
        .success(function (data) {
          if (!data.length || data.length < 1) {
            alert('Sorry, could not load object "' + preselected + '"');
            return;
          }
          pubsub.publish("UpdateRankingsWithFeaturedAsteroid", [data[0]]);
        });
    }
  };
  $scope.Lookup = function (suggestion) {
    pubsub.publish("UpdateRankingsWithFeaturedAsteroid", [suggestion.data]);
  };
}
function AsteroidTableCtrl($scope, $http, pubsub) {
  $scope.rankings = [];
  $scope.loading_initial_rankings = true;
  $scope.sort_orders = [
    { text: "most cost effective", search_value: "score" },
    { text: "most valuable", search_value: "value" },
    { text: "most accessible", search_value: "accessibility" },
    { text: "upcoming passes", search_value: "upcoming" },
    { text: "smallest", search_value: "smallest" },
  ];
  $scope.limit_options = [100, 300, 500, 1e3, 4e3];
  $scope.Init = function () {
    $scope.limit = $scope.limit_options[1];
    $scope.sort_by = $scope.sort_orders[0];
    $scope.UpdateRankings();
  };
  var rankings_cache = new SimpleCache(function (item) {
    return item.sort_by + "|" + item.limit;
  });
  $scope.UpdateRankings = function () {
    var params = { sort_by: $scope.sort_by.search_value, limit: $scope.limit };
    var cache_result = rankings_cache.Get(params);
    if (cache_result) {
      $scope.rankings = cache_result;
      pubsub.publish("NewAsteroidRanking", [$scope.rankings]);
      BroadcastInitialRankingsLoaded();
    } else {
      $("#results-table-loader").show();
      $scope.rankings = [];
      $http
        .get(
          "/asterank/api/rankings?sort_by=" +
            params.sort_by +
            "&limit=" +
            params.limit
        )
        .success(function (data) {
          $scope.rankings = data;
          rankings_cache.Set(params, data);
          $("#results-table-loader").hide();
          pubsub.publish("NewAsteroidRanking", [$scope.rankings]);
          BroadcastInitialRankingsLoaded();
        });
    }
  };
  $scope.AsteroidClick = function (obj) {
    if (obj === $scope.selected) $scope.selected = null;
    else $scope.selected = obj;
    pubsub.publish("AsteroidDetailsClick", [obj]);
  };
  var inserted_asteroids = {};
  pubsub.subscribe("UpdateRankingsWithFeaturedAsteroid", function (asteroid) {
    $scope.selected = asteroid;
    if (!inserted_asteroids[asteroid.full_name]) {
      $scope.rankings.unshift(asteroid);
      pubsub.publish("NewAsteroidRanking", [$scope.rankings]);
      inserted_asteroids[asteroid.full_name] = true;
    }
    pubsub.publish("AsteroidDetailsClick", [asteroid]);
  });
  function BroadcastInitialRankingsLoaded() {
    if ($scope.loading_initial_rankings) {
      pubsub.publish("InitialRankingsLoaded");
      $scope.loading_initial_rankings = false;
    }
  }
}
function CustomInputCtrl($scope, $http, pubsub) {
  var SERIALIZED_URL_PARAM = "s";
  $scope.object = {
    a: Ephemeris.earth.a,
    e: Ephemeris.earth.e,
    i: Ephemeris.earth.i,
    om: Ephemeris.earth.om,
    w: Ephemeris.earth.w_bar,
    ma: Ephemeris.earth.ma,
    epoch: Ephemeris.earth.epoch,
    per: Ephemeris.earth.P,
    spec: "?",
    custom_object: true,
  };
  $scope.num_custom_objects = 1;
  $scope.Init = function () {
    pubsub.subscribe("ShowCustomInputCtrl", function () {
      $scope.StartCustomOrbit();
    });
    $scope.$watch(
      "object",
      function (oldVal, newVal) {
        $scope.direct_url =
          "http://asterank.com/?s=" +
          encodeURIComponent(JSON.stringify($scope.object));
      },
      true
    );
    var serialized = getURLParameter(SERIALIZED_URL_PARAM);
    if (serialized)
      pubsub.subscribe("InitialRankingsLoaded", function () {
        var parsed_obj = JSON.parse(decodeURIComponent(serialized));
        $scope.obj = parsed_obj;
        $scope.UseCustomInput();
      });
  };
  $scope.StartCustomOrbit = function () {
    $scope.show_custom_input = true;
    setTimeout(function () {
      var element = document.getElementById("filepicker-widget");
      filepicker.constructWidget(element);
    }, 0);
  };
  $scope.UseCustomInput = function () {
    var custom_obj = $.extend({}, $scope.object);
    custom_obj.name =
      custom_obj.full_name =
      custom_obj.prov_des =
        "Custom Object " + $scope.num_custom_objects;
    custom_obj.P = $scope.object.per;
    $scope.num_custom_objects++;
    pubsub.publish("UpdateRankingsWithFeaturedAsteroid", [custom_obj]);
    $scope.CloseCustomInput();
  };
  $scope.SaveAndUseCustomInput = function () {
    $http
      .post("/asterank/api/user_objects", {
        object: $scope.object,
        keys: $scope.image_keys,
      })
      .success(function (data) {
        console.log("Object saved", data);
      });
    $scope.UseCustomInput();
  };
  $scope.CloseCustomInput = function () {
    $scope.show_custom_input = false;
  };
  $scope.OrbitLinkFocused = function () {
    $("#link-orbit-container input").select();
  };
  $scope.FilepickerCallback = function (e) {
    if (!e.fpfiles) return;
    var keys = [];
    for (var i = 0; i < e.fpfiles.length; i++) {
      var file = e.fpfiles[i];
      keys.push(file.key);
    }
    $scope.image_keys = keys;
  };
}
function IntroStatementCtrl($scope, pubsub) {
  $scope.show = true;
  pubsub.subscribe("HideIntroStatement", function () {
    $scope.show = false;
  });
  pubsub.subscribe("ShowIntroStatement", function () {
    $scope.show = true;
  });
}
("use strict");
var THREE = THREE || { REVISION: "58" };
self.console = self.console || {
  info: function () {},
  log: function () {},
  debug: function () {},
  warn: function () {},
  error: function () {},
};
self.Int32Array = self.Int32Array || Array;
self.Float32Array = self.Float32Array || Array;
String.prototype.trim =
  String.prototype.trim ||
  function () {
    return this.replace(/^\s+|\s+$/g, "");
  };
THREE.extend = function (a, b) {
  if (Object.keys)
    for (var c = Object.keys(b), d = 0, e = c.length; d < e; d++) {
      var f = c[d];
      Object.defineProperty(a, f, Object.getOwnPropertyDescriptor(b, f));
    }
  else for (f in ((c = {}.hasOwnProperty), b)) c.call(b, f) && (a[f] = b[f]);
  return a;
};
(function () {
  for (
    var a = 0, b = ["ms", "moz", "webkit", "o"], c = 0;
    c < b.length && !window.requestAnimationFrame;
    ++c
  )
    (window.requestAnimationFrame = window[b[c] + "RequestAnimationFrame"]),
      (window.cancelAnimationFrame =
        window[b[c] + "CancelAnimationFrame"] ||
        window[b[c] + "CancelRequestAnimationFrame"]);
  void 0 === window.requestAnimationFrame &&
    (window.requestAnimationFrame = function (b) {
      var c = Date.now(),
        f = Math.max(0, 16 - (c - a)),
        g = window.setTimeout(function () {
          b(c + f);
        }, f);
      a = c + f;
      return g;
    });
  window.cancelAnimationFrame =
    window.cancelAnimationFrame ||
    function (a) {
      window.clearTimeout(a);
    };
})();
THREE.CullFaceNone = 0;
THREE.CullFaceBack = 1;
THREE.CullFaceFront = 2;
THREE.CullFaceFrontBack = 3;
THREE.FrontFaceDirectionCW = 0;
THREE.FrontFaceDirectionCCW = 1;
THREE.BasicShadowMap = 0;
THREE.PCFShadowMap = 1;
THREE.PCFSoftShadowMap = 2;
THREE.FrontSide = 0;
THREE.BackSide = 1;
THREE.DoubleSide = 2;
THREE.NoShading = 0;
THREE.FlatShading = 1;
THREE.SmoothShading = 2;
THREE.NoColors = 0;
THREE.FaceColors = 1;
THREE.VertexColors = 2;
THREE.NoBlending = 0;
THREE.NormalBlending = 1;
THREE.AdditiveBlending = 2;
THREE.SubtractiveBlending = 3;
THREE.MultiplyBlending = 4;
THREE.CustomBlending = 5;
THREE.AddEquation = 100;
THREE.SubtractEquation = 101;
THREE.ReverseSubtractEquation = 102;
THREE.ZeroFactor = 200;
THREE.OneFactor = 201;
THREE.SrcColorFactor = 202;
THREE.OneMinusSrcColorFactor = 203;
THREE.SrcAlphaFactor = 204;
THREE.OneMinusSrcAlphaFactor = 205;
THREE.DstAlphaFactor = 206;
THREE.OneMinusDstAlphaFactor = 207;
THREE.DstColorFactor = 208;
THREE.OneMinusDstColorFactor = 209;
THREE.SrcAlphaSaturateFactor = 210;
THREE.MultiplyOperation = 0;
THREE.MixOperation = 1;
THREE.AddOperation = 2;
THREE.UVMapping = function () {};
THREE.CubeReflectionMapping = function () {};
THREE.CubeRefractionMapping = function () {};
THREE.SphericalReflectionMapping = function () {};
THREE.SphericalRefractionMapping = function () {};
THREE.RepeatWrapping = 1e3;
THREE.ClampToEdgeWrapping = 1001;
THREE.MirroredRepeatWrapping = 1002;
THREE.NearestFilter = 1003;
THREE.NearestMipMapNearestFilter = 1004;
THREE.NearestMipMapLinearFilter = 1005;
THREE.LinearFilter = 1006;
THREE.LinearMipMapNearestFilter = 1007;
THREE.LinearMipMapLinearFilter = 1008;
THREE.UnsignedByteType = 1009;
THREE.ByteType = 1010;
THREE.ShortType = 1011;
THREE.UnsignedShortType = 1012;
THREE.IntType = 1013;
THREE.UnsignedIntType = 1014;
THREE.FloatType = 1015;
THREE.UnsignedShort4444Type = 1016;
THREE.UnsignedShort5551Type = 1017;
THREE.UnsignedShort565Type = 1018;
THREE.AlphaFormat = 1019;
THREE.RGBFormat = 1020;
THREE.RGBAFormat = 1021;
THREE.LuminanceFormat = 1022;
THREE.LuminanceAlphaFormat = 1023;
THREE.RGB_S3TC_DXT1_Format = 2001;
THREE.RGBA_S3TC_DXT1_Format = 2002;
THREE.RGBA_S3TC_DXT3_Format = 2003;
THREE.RGBA_S3TC_DXT5_Format = 2004;
THREE.Color = function (a) {
  void 0 !== a && this.set(a);
  return this;
};
THREE.Color.prototype = {
  constructor: THREE.Color,
  r: 1,
  g: 1,
  b: 1,
  set: function (a) {
    a instanceof THREE.Color
      ? this.copy(a)
      : "number" === typeof a
      ? this.setHex(a)
      : "string" === typeof a && this.setStyle(a);
    return this;
  },
  setHex: function (a) {
    a = Math.floor(a);
    this.r = ((a >> 16) & 255) / 255;
    this.g = ((a >> 8) & 255) / 255;
    this.b = (a & 255) / 255;
    return this;
  },
  setRGB: function (a, b, c) {
    this.r = a;
    this.g = b;
    this.b = c;
    return this;
  },
  setHSL: function (a, b, c) {
    if (0 === b) this.r = this.g = this.b = c;
    else {
      var d = function (a, b, c) {
          0 > c && (c += 1);
          1 < c && (c -= 1);
          return c < 1 / 6
            ? a + 6 * (b - a) * c
            : 0.5 > c
            ? b
            : c < 2 / 3
            ? a + 6 * (b - a) * (2 / 3 - c)
            : a;
        },
        b = 0.5 >= c ? c * (1 + b) : c + b - c * b,
        c = 2 * c - b;
      this.r = d(c, b, a + 1 / 3);
      this.g = d(c, b, a);
      this.b = d(c, b, a - 1 / 3);
    }
    return this;
  },
  setStyle: function (a) {
    if (/^rgb\((\d+),(\d+),(\d+)\)$/i.test(a))
      return (
        (a = /^rgb\((\d+),(\d+),(\d+)\)$/i.exec(a)),
        (this.r = Math.min(255, parseInt(a[1], 10)) / 255),
        (this.g = Math.min(255, parseInt(a[2], 10)) / 255),
        (this.b = Math.min(255, parseInt(a[3], 10)) / 255),
        this
      );
    if (/^rgb\((\d+)\%,(\d+)\%,(\d+)\%\)$/i.test(a))
      return (
        (a = /^rgb\((\d+)\%,(\d+)\%,(\d+)\%\)$/i.exec(a)),
        (this.r = Math.min(100, parseInt(a[1], 10)) / 100),
        (this.g = Math.min(100, parseInt(a[2], 10)) / 100),
        (this.b = Math.min(100, parseInt(a[3], 10)) / 100),
        this
      );
    if (/^\#([0-9a-f]{6})$/i.test(a))
      return (
        (a = /^\#([0-9a-f]{6})$/i.exec(a)),
        this.setHex(parseInt(a[1], 16)),
        this
      );
    if (/^\#([0-9a-f])([0-9a-f])([0-9a-f])$/i.test(a))
      return (
        (a = /^\#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(a)),
        this.setHex(parseInt(a[1] + a[1] + a[2] + a[2] + a[3] + a[3], 16)),
        this
      );
    if (/^(\w+)$/i.test(a)) return this.setHex(THREE.ColorKeywords[a]), this;
  },
  copy: function (a) {
    this.r = a.r;
    this.g = a.g;
    this.b = a.b;
    return this;
  },
  copyGammaToLinear: function (a) {
    this.r = a.r * a.r;
    this.g = a.g * a.g;
    this.b = a.b * a.b;
    return this;
  },
  copyLinearToGamma: function (a) {
    this.r = Math.sqrt(a.r);
    this.g = Math.sqrt(a.g);
    this.b = Math.sqrt(a.b);
    return this;
  },
  convertGammaToLinear: function () {
    var a = this.r,
      b = this.g,
      c = this.b;
    this.r = a * a;
    this.g = b * b;
    this.b = c * c;
    return this;
  },
  convertLinearToGamma: function () {
    this.r = Math.sqrt(this.r);
    this.g = Math.sqrt(this.g);
    this.b = Math.sqrt(this.b);
    return this;
  },
  getHex: function () {
    return (
      ((255 * this.r) << 16) ^ ((255 * this.g) << 8) ^ ((255 * this.b) << 0)
    );
  },
  getHexString: function () {
    return ("000000" + this.getHex().toString(16)).slice(-6);
  },
  getHSL: (function () {
    var a = { h: 0, s: 0, l: 0 };
    return function () {
      var b = this.r,
        c = this.g,
        d = this.b,
        e = Math.max(b, c, d),
        f = Math.min(b, c, d),
        g,
        h = (f + e) / 2;
      if (f === e) f = g = 0;
      else {
        var i = e - f,
          f = 0.5 >= h ? i / (e + f) : i / (2 - e - f);
        switch (e) {
          case b:
            g = (c - d) / i + (c < d ? 6 : 0);
            break;
          case c:
            g = (d - b) / i + 2;
            break;
          case d:
            g = (b - c) / i + 4;
        }
        g /= 6;
      }
      a.h = g;
      a.s = f;
      a.l = h;
      return a;
    };
  })(),
  getStyle: function () {
    return (
      "rgb(" +
      ((255 * this.r) | 0) +
      "," +
      ((255 * this.g) | 0) +
      "," +
      ((255 * this.b) | 0) +
      ")"
    );
  },
  offsetHSL: function (a, b, c) {
    var d = this.getHSL();
    d.h += a;
    d.s += b;
    d.l += c;
    this.setHSL(d.h, d.s, d.l);
    return this;
  },
  add: function (a) {
    this.r += a.r;
    this.g += a.g;
    this.b += a.b;
    return this;
  },
  addColors: function (a, b) {
    this.r = a.r + b.r;
    this.g = a.g + b.g;
    this.b = a.b + b.b;
    return this;
  },
  addScalar: function (a) {
    this.r += a;
    this.g += a;
    this.b += a;
    return this;
  },
  multiply: function (a) {
    this.r *= a.r;
    this.g *= a.g;
    this.b *= a.b;
    return this;
  },
  multiplyScalar: function (a) {
    this.r *= a;
    this.g *= a;
    this.b *= a;
    return this;
  },
  lerp: function (a, b) {
    this.r += (a.r - this.r) * b;
    this.g += (a.g - this.g) * b;
    this.b += (a.b - this.b) * b;
    return this;
  },
  equals: function (a) {
    return a.r === this.r && a.g === this.g && a.b === this.b;
  },
  clone: function () {
    return new THREE.Color().setRGB(this.r, this.g, this.b);
  },
};
THREE.ColorKeywords = {
  aliceblue: 15792383,
  antiquewhite: 16444375,
  aqua: 65535,
  aquamarine: 8388564,
  azure: 15794175,
  beige: 16119260,
  bisque: 16770244,
  black: 0,
  blanchedalmond: 16772045,
  blue: 255,
  blueviolet: 9055202,
  brown: 10824234,
  burlywood: 14596231,
  cadetblue: 6266528,
  chartreuse: 8388352,
  chocolate: 13789470,
  coral: 16744272,
  cornflowerblue: 6591981,
  cornsilk: 16775388,
  crimson: 14423100,
  cyan: 65535,
  darkblue: 139,
  darkcyan: 35723,
  darkgoldenrod: 12092939,
  darkgray: 11119017,
  darkgreen: 25600,
  darkgrey: 11119017,
  darkkhaki: 12433259,
  darkmagenta: 9109643,
  darkolivegreen: 5597999,
  darkorange: 16747520,
  darkorchid: 10040012,
  darkred: 9109504,
  darksalmon: 15308410,
  darkseagreen: 9419919,
  darkslateblue: 4734347,
  darkslategray: 3100495,
  darkslategrey: 3100495,
  darkturquoise: 52945,
  darkviolet: 9699539,
  deeppink: 16716947,
  deepskyblue: 49151,
  dimgray: 6908265,
  dimgrey: 6908265,
  dodgerblue: 2003199,
  firebrick: 11674146,
  floralwhite: 16775920,
  forestgreen: 2263842,
  fuchsia: 16711935,
  gainsboro: 14474460,
  ghostwhite: 16316671,
  gold: 16766720,
  goldenrod: 14329120,
  gray: 8421504,
  green: 32768,
  greenyellow: 11403055,
  grey: 8421504,
  honeydew: 15794160,
  hotpink: 16738740,
  indianred: 13458524,
  indigo: 4915330,
  ivory: 16777200,
  khaki: 15787660,
  lavender: 15132410,
  lavenderblush: 16773365,
  lawngreen: 8190976,
  lemonchiffon: 16775885,
  lightblue: 11393254,
  lightcoral: 15761536,
  lightcyan: 14745599,
  lightgoldenrodyellow: 16448210,
  lightgray: 13882323,
  lightgreen: 9498256,
  lightgrey: 13882323,
  lightpink: 16758465,
  lightsalmon: 16752762,
  lightseagreen: 2142890,
  lightskyblue: 8900346,
  lightslategray: 7833753,
  lightslategrey: 7833753,
  lightsteelblue: 11584734,
  lightyellow: 16777184,
  lime: 65280,
  limegreen: 3329330,
  linen: 16445670,
  magenta: 16711935,
  maroon: 8388608,
  mediumaquamarine: 6737322,
  mediumblue: 205,
  mediumorchid: 12211667,
  mediumpurple: 9662683,
  mediumseagreen: 3978097,
  mediumslateblue: 8087790,
  mediumspringgreen: 64154,
  mediumturquoise: 4772300,
  mediumvioletred: 13047173,
  midnightblue: 1644912,
  mintcream: 16121850,
  mistyrose: 16770273,
  moccasin: 16770229,
  navajowhite: 16768685,
  navy: 128,
  oldlace: 16643558,
  olive: 8421376,
  olivedrab: 7048739,
  orange: 16753920,
  orangered: 16729344,
  orchid: 14315734,
  palegoldenrod: 15657130,
  palegreen: 10025880,
  paleturquoise: 11529966,
  palevioletred: 14381203,
  papayawhip: 16773077,
  peachpuff: 16767673,
  peru: 13468991,
  pink: 16761035,
  plum: 14524637,
  powderblue: 11591910,
  purple: 8388736,
  red: 16711680,
  rosybrown: 12357519,
  royalblue: 4286945,
  saddlebrown: 9127187,
  salmon: 16416882,
  sandybrown: 16032864,
  seagreen: 3050327,
  seashell: 16774638,
  sienna: 10506797,
  silver: 12632256,
  skyblue: 8900331,
  slateblue: 6970061,
  slategray: 7372944,
  slategrey: 7372944,
  snow: 16775930,
  springgreen: 65407,
  steelblue: 4620980,
  tan: 13808780,
  teal: 32896,
  thistle: 14204888,
  tomato: 16737095,
  turquoise: 4251856,
  violet: 15631086,
  wheat: 16113331,
  white: 16777215,
  whitesmoke: 16119285,
  yellow: 16776960,
  yellowgreen: 10145074,
};
THREE.Quaternion = function (a, b, c, d) {
  this.x = a || 0;
  this.y = b || 0;
  this.z = c || 0;
  this.w = void 0 !== d ? d : 1;
};
THREE.Quaternion.prototype = {
  constructor: THREE.Quaternion,
  set: function (a, b, c, d) {
    this.x = a;
    this.y = b;
    this.z = c;
    this.w = d;
    return this;
  },
  copy: function (a) {
    this.x = a.x;
    this.y = a.y;
    this.z = a.z;
    this.w = a.w;
    return this;
  },
  setFromEuler: function (a, b) {
    var c = Math.cos(a.x / 2),
      d = Math.cos(a.y / 2),
      e = Math.cos(a.z / 2),
      f = Math.sin(a.x / 2),
      g = Math.sin(a.y / 2),
      h = Math.sin(a.z / 2);
    void 0 === b || "XYZ" === b
      ? ((this.x = f * d * e + c * g * h),
        (this.y = c * g * e - f * d * h),
        (this.z = c * d * h + f * g * e),
        (this.w = c * d * e - f * g * h))
      : "YXZ" === b
      ? ((this.x = f * d * e + c * g * h),
        (this.y = c * g * e - f * d * h),
        (this.z = c * d * h - f * g * e),
        (this.w = c * d * e + f * g * h))
      : "ZXY" === b
      ? ((this.x = f * d * e - c * g * h),
        (this.y = c * g * e + f * d * h),
        (this.z = c * d * h + f * g * e),
        (this.w = c * d * e - f * g * h))
      : "ZYX" === b
      ? ((this.x = f * d * e - c * g * h),
        (this.y = c * g * e + f * d * h),
        (this.z = c * d * h - f * g * e),
        (this.w = c * d * e + f * g * h))
      : "YZX" === b
      ? ((this.x = f * d * e + c * g * h),
        (this.y = c * g * e + f * d * h),
        (this.z = c * d * h - f * g * e),
        (this.w = c * d * e - f * g * h))
      : "XZY" === b &&
        ((this.x = f * d * e - c * g * h),
        (this.y = c * g * e - f * d * h),
        (this.z = c * d * h + f * g * e),
        (this.w = c * d * e + f * g * h));
    return this;
  },
  setFromAxisAngle: function (a, b) {
    var c = b / 2,
      d = Math.sin(c);
    this.x = a.x * d;
    this.y = a.y * d;
    this.z = a.z * d;
    this.w = Math.cos(c);
    return this;
  },
  setFromRotationMatrix: function (a) {
    var b = a.elements,
      c = b[0],
      a = b[4],
      d = b[8],
      e = b[1],
      f = b[5],
      g = b[9],
      h = b[2],
      i = b[6],
      b = b[10],
      j = c + f + b;
    0 < j
      ? ((c = 0.5 / Math.sqrt(j + 1)),
        (this.w = 0.25 / c),
        (this.x = (i - g) * c),
        (this.y = (d - h) * c),
        (this.z = (e - a) * c))
      : c > f && c > b
      ? ((c = 2 * Math.sqrt(1 + c - f - b)),
        (this.w = (i - g) / c),
        (this.x = 0.25 * c),
        (this.y = (a + e) / c),
        (this.z = (d + h) / c))
      : f > b
      ? ((c = 2 * Math.sqrt(1 + f - c - b)),
        (this.w = (d - h) / c),
        (this.x = (a + e) / c),
        (this.y = 0.25 * c),
        (this.z = (g + i) / c))
      : ((c = 2 * Math.sqrt(1 + b - c - f)),
        (this.w = (e - a) / c),
        (this.x = (d + h) / c),
        (this.y = (g + i) / c),
        (this.z = 0.25 * c));
    return this;
  },
  inverse: function () {
    this.conjugate().normalize();
    return this;
  },
  conjugate: function () {
    this.x *= -1;
    this.y *= -1;
    this.z *= -1;
    return this;
  },
  lengthSq: function () {
    return (
      this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w
    );
  },
  length: function () {
    return Math.sqrt(
      this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w
    );
  },
  normalize: function () {
    var a = this.length();
    0 === a
      ? ((this.z = this.y = this.x = 0), (this.w = 1))
      : ((a = 1 / a),
        (this.x *= a),
        (this.y *= a),
        (this.z *= a),
        (this.w *= a));
    return this;
  },
  multiply: function (a, b) {
    return void 0 !== b
      ? (console.warn(
          "DEPRECATED: Quaternion's .multiply() now only accepts one argument. Use .multiplyQuaternions( a, b ) instead."
        ),
        this.multiplyQuaternions(a, b))
      : this.multiplyQuaternions(this, a);
  },
  multiplyQuaternions: function (a, b) {
    var c = a.x,
      d = a.y,
      e = a.z,
      f = a.w,
      g = b.x,
      h = b.y,
      i = b.z,
      j = b.w;
    this.x = c * j + f * g + d * i - e * h;
    this.y = d * j + f * h + e * g - c * i;
    this.z = e * j + f * i + c * h - d * g;
    this.w = f * j - c * g - d * h - e * i;
    return this;
  },
  multiplyVector3: function (a) {
    console.warn(
      "DEPRECATED: Quaternion's .multiplyVector3() has been removed. Use is now vector.applyQuaternion( quaternion ) instead."
    );
    return a.applyQuaternion(this);
  },
  slerp: function (a, b) {
    var c = this.x,
      d = this.y,
      e = this.z,
      f = this.w,
      g = f * a.w + c * a.x + d * a.y + e * a.z;
    0 > g
      ? ((this.w = -a.w),
        (this.x = -a.x),
        (this.y = -a.y),
        (this.z = -a.z),
        (g = -g))
      : this.copy(a);
    if (1 <= g)
      return (this.w = f), (this.x = c), (this.y = d), (this.z = e), this;
    var h = Math.acos(g),
      i = Math.sqrt(1 - g * g);
    if (0.001 > Math.abs(i))
      return (
        (this.w = 0.5 * (f + this.w)),
        (this.x = 0.5 * (c + this.x)),
        (this.y = 0.5 * (d + this.y)),
        (this.z = 0.5 * (e + this.z)),
        this
      );
    g = Math.sin((1 - b) * h) / i;
    h = Math.sin(b * h) / i;
    this.w = f * g + this.w * h;
    this.x = c * g + this.x * h;
    this.y = d * g + this.y * h;
    this.z = e * g + this.z * h;
    return this;
  },
  equals: function (a) {
    return a.x === this.x && a.y === this.y && a.z === this.z && a.w === this.w;
  },
  fromArray: function (a) {
    this.x = a[0];
    this.y = a[1];
    this.z = a[2];
    this.w = a[3];
    return this;
  },
  toArray: function () {
    return [this.x, this.y, this.z, this.w];
  },
  clone: function () {
    return new THREE.Quaternion(this.x, this.y, this.z, this.w);
  },
};
THREE.Quaternion.slerp = function (a, b, c, d) {
  return c.copy(a).slerp(b, d);
};
THREE.Vector2 = function (a, b) {
  this.x = a || 0;
  this.y = b || 0;
};
THREE.Vector2.prototype = {
  constructor: THREE.Vector2,
  set: function (a, b) {
    this.x = a;
    this.y = b;
    return this;
  },
  setX: function (a) {
    this.x = a;
    return this;
  },
  setY: function (a) {
    this.y = a;
    return this;
  },
  setComponent: function (a, b) {
    switch (a) {
      case 0:
        this.x = b;
        break;
      case 1:
        this.y = b;
        break;
      default:
        throw Error("index is out of range: " + a);
    }
  },
  getComponent: function (a) {
    switch (a) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      default:
        throw Error("index is out of range: " + a);
    }
  },
  copy: function (a) {
    this.x = a.x;
    this.y = a.y;
    return this;
  },
  add: function (a, b) {
    if (void 0 !== b)
      return (
        console.warn(
          "DEPRECATED: Vector2's .add() now only accepts one argument. Use .addVectors( a, b ) instead."
        ),
        this.addVectors(a, b)
      );
    this.x += a.x;
    this.y += a.y;
    return this;
  },
  addVectors: function (a, b) {
    this.x = a.x + b.x;
    this.y = a.y + b.y;
    return this;
  },
  addScalar: function (a) {
    this.x += a;
    this.y += a;
    return this;
  },
  sub: function (a, b) {
    if (void 0 !== b)
      return (
        console.warn(
          "DEPRECATED: Vector2's .sub() now only accepts one argument. Use .subVectors( a, b ) instead."
        ),
        this.subVectors(a, b)
      );
    this.x -= a.x;
    this.y -= a.y;
    return this;
  },
  subVectors: function (a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    return this;
  },
  multiplyScalar: function (a) {
    this.x *= a;
    this.y *= a;
    return this;
  },
  divideScalar: function (a) {
    0 !== a ? ((this.x /= a), (this.y /= a)) : this.set(0, 0);
    return this;
  },
  min: function (a) {
    this.x > a.x && (this.x = a.x);
    this.y > a.y && (this.y = a.y);
    return this;
  },
  max: function (a) {
    this.x < a.x && (this.x = a.x);
    this.y < a.y && (this.y = a.y);
    return this;
  },
  clamp: function (a, b) {
    this.x < a.x ? (this.x = a.x) : this.x > b.x && (this.x = b.x);
    this.y < a.y ? (this.y = a.y) : this.y > b.y && (this.y = b.y);
    return this;
  },
  negate: function () {
    return this.multiplyScalar(-1);
  },
  dot: function (a) {
    return this.x * a.x + this.y * a.y;
  },
  lengthSq: function () {
    return this.x * this.x + this.y * this.y;
  },
  length: function () {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  },
  normalize: function () {
    return this.divideScalar(this.length());
  },
  distanceTo: function (a) {
    return Math.sqrt(this.distanceToSquared(a));
  },
  distanceToSquared: function (a) {
    var b = this.x - a.x,
      a = this.y - a.y;
    return b * b + a * a;
  },
  setLength: function (a) {
    var b = this.length();
    0 !== b && a !== b && this.multiplyScalar(a / b);
    return this;
  },
  lerp: function (a, b) {
    this.x += (a.x - this.x) * b;
    this.y += (a.y - this.y) * b;
    return this;
  },
  equals: function (a) {
    return a.x === this.x && a.y === this.y;
  },
  fromArray: function (a) {
    this.x = a[0];
    this.y = a[1];
    return this;
  },
  toArray: function () {
    return [this.x, this.y];
  },
  clone: function () {
    return new THREE.Vector2(this.x, this.y);
  },
};
THREE.Vector3 = function (a, b, c) {
  this.x = a || 0;
  this.y = b || 0;
  this.z = c || 0;
};
THREE.Vector3.prototype = {
  constructor: THREE.Vector3,
  set: function (a, b, c) {
    this.x = a;
    this.y = b;
    this.z = c;
    return this;
  },
  setX: function (a) {
    this.x = a;
    return this;
  },
  setY: function (a) {
    this.y = a;
    return this;
  },
  setZ: function (a) {
    this.z = a;
    return this;
  },
  setComponent: function (a, b) {
    switch (a) {
      case 0:
        this.x = b;
        break;
      case 1:
        this.y = b;
        break;
      case 2:
        this.z = b;
        break;
      default:
        throw Error("index is out of range: " + a);
    }
  },
  getComponent: function (a) {
    switch (a) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      case 2:
        return this.z;
      default:
        throw Error("index is out of range: " + a);
    }
  },
  copy: function (a) {
    this.x = a.x;
    this.y = a.y;
    this.z = a.z;
    return this;
  },
  add: function (a, b) {
    if (void 0 !== b)
      return (
        console.warn(
          "DEPRECATED: Vector3's .add() now only accepts one argument. Use .addVectors( a, b ) instead."
        ),
        this.addVectors(a, b)
      );
    this.x += a.x;
    this.y += a.y;
    this.z += a.z;
    return this;
  },
  addScalar: function (a) {
    this.x += a;
    this.y += a;
    this.z += a;
    return this;
  },
  addVectors: function (a, b) {
    this.x = a.x + b.x;
    this.y = a.y + b.y;
    this.z = a.z + b.z;
    return this;
  },
  sub: function (a, b) {
    if (void 0 !== b)
      return (
        console.warn(
          "DEPRECATED: Vector3's .sub() now only accepts one argument. Use .subVectors( a, b ) instead."
        ),
        this.subVectors(a, b)
      );
    this.x -= a.x;
    this.y -= a.y;
    this.z -= a.z;
    return this;
  },
  subVectors: function (a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    return this;
  },
  multiply: function (a, b) {
    if (void 0 !== b)
      return (
        console.warn(
          "DEPRECATED: Vector3's .multiply() now only accepts one argument. Use .multiplyVectors( a, b ) instead."
        ),
        this.multiplyVectors(a, b)
      );
    this.x *= a.x;
    this.y *= a.y;
    this.z *= a.z;
    return this;
  },
  multiplyScalar: function (a) {
    this.x *= a;
    this.y *= a;
    this.z *= a;
    return this;
  },
  multiplyVectors: function (a, b) {
    this.x = a.x * b.x;
    this.y = a.y * b.y;
    this.z = a.z * b.z;
    return this;
  },
  applyMatrix3: function (a) {
    var b = this.x,
      c = this.y,
      d = this.z,
      a = a.elements;
    this.x = a[0] * b + a[3] * c + a[6] * d;
    this.y = a[1] * b + a[4] * c + a[7] * d;
    this.z = a[2] * b + a[5] * c + a[8] * d;
    return this;
  },
  applyMatrix4: function (a) {
    var b = this.x,
      c = this.y,
      d = this.z,
      a = a.elements;
    this.x = a[0] * b + a[4] * c + a[8] * d + a[12];
    this.y = a[1] * b + a[5] * c + a[9] * d + a[13];
    this.z = a[2] * b + a[6] * c + a[10] * d + a[14];
    return this;
  },
  applyProjection: function (a) {
    var b = this.x,
      c = this.y,
      d = this.z,
      a = a.elements,
      e = 1 / (a[3] * b + a[7] * c + a[11] * d + a[15]);
    this.x = (a[0] * b + a[4] * c + a[8] * d + a[12]) * e;
    this.y = (a[1] * b + a[5] * c + a[9] * d + a[13]) * e;
    this.z = (a[2] * b + a[6] * c + a[10] * d + a[14]) * e;
    return this;
  },
  applyQuaternion: function (a) {
    var b = this.x,
      c = this.y,
      d = this.z,
      e = a.x,
      f = a.y,
      g = a.z,
      a = a.w,
      h = a * b + f * d - g * c,
      i = a * c + g * b - e * d,
      j = a * d + e * c - f * b,
      b = -e * b - f * c - g * d;
    this.x = h * a + b * -e + i * -g - j * -f;
    this.y = i * a + b * -f + j * -e - h * -g;
    this.z = j * a + b * -g + h * -f - i * -e;
    return this;
  },
  transformDirection: function (a) {
    var b = this.x,
      c = this.y,
      d = this.z,
      a = a.elements;
    this.x = a[0] * b + a[4] * c + a[8] * d;
    this.y = a[1] * b + a[5] * c + a[9] * d;
    this.z = a[2] * b + a[6] * c + a[10] * d;
    this.normalize();
    return this;
  },
  divide: function (a) {
    this.x /= a.x;
    this.y /= a.y;
    this.z /= a.z;
    return this;
  },
  divideScalar: function (a) {
    0 !== a
      ? ((this.x /= a), (this.y /= a), (this.z /= a))
      : (this.z = this.y = this.x = 0);
    return this;
  },
  min: function (a) {
    this.x > a.x && (this.x = a.x);
    this.y > a.y && (this.y = a.y);
    this.z > a.z && (this.z = a.z);
    return this;
  },
  max: function (a) {
    this.x < a.x && (this.x = a.x);
    this.y < a.y && (this.y = a.y);
    this.z < a.z && (this.z = a.z);
    return this;
  },
  clamp: function (a, b) {
    this.x < a.x ? (this.x = a.x) : this.x > b.x && (this.x = b.x);
    this.y < a.y ? (this.y = a.y) : this.y > b.y && (this.y = b.y);
    this.z < a.z ? (this.z = a.z) : this.z > b.z && (this.z = b.z);
    return this;
  },
  negate: function () {
    return this.multiplyScalar(-1);
  },
  dot: function (a) {
    return this.x * a.x + this.y * a.y + this.z * a.z;
  },
  lengthSq: function () {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  },
  length: function () {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  },
  lengthManhattan: function () {
    return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z);
  },
  normalize: function () {
    return this.divideScalar(this.length());
  },
  setLength: function (a) {
    var b = this.length();
    0 !== b && a !== b && this.multiplyScalar(a / b);
    return this;
  },
  lerp: function (a, b) {
    this.x += (a.x - this.x) * b;
    this.y += (a.y - this.y) * b;
    this.z += (a.z - this.z) * b;
    return this;
  },
  cross: function (a, b) {
    if (void 0 !== b)
      return (
        console.warn(
          "DEPRECATED: Vector3's .cross() now only accepts one argument. Use .crossVectors( a, b ) instead."
        ),
        this.crossVectors(a, b)
      );
    var c = this.x,
      d = this.y,
      e = this.z;
    this.x = d * a.z - e * a.y;
    this.y = e * a.x - c * a.z;
    this.z = c * a.y - d * a.x;
    return this;
  },
  crossVectors: function (a, b) {
    this.x = a.y * b.z - a.z * b.y;
    this.y = a.z * b.x - a.x * b.z;
    this.z = a.x * b.y - a.y * b.x;
    return this;
  },
  angleTo: function (a) {
    a = this.dot(a) / (this.length() * a.length());
    return Math.acos(THREE.Math.clamp(a, -1, 1));
  },
  distanceTo: function (a) {
    return Math.sqrt(this.distanceToSquared(a));
  },
  distanceToSquared: function (a) {
    var b = this.x - a.x,
      c = this.y - a.y,
      a = this.z - a.z;
    return b * b + c * c + a * a;
  },
  setEulerFromRotationMatrix: function (a, b) {
    function c(a) {
      return Math.min(Math.max(a, -1), 1);
    }
    var d = a.elements,
      e = d[0],
      f = d[4],
      g = d[8],
      h = d[1],
      i = d[5],
      j = d[9],
      m = d[2],
      p = d[6],
      d = d[10];
    void 0 === b || "XYZ" === b
      ? ((this.y = Math.asin(c(g))),
        0.99999 > Math.abs(g)
          ? ((this.x = Math.atan2(-j, d)), (this.z = Math.atan2(-f, e)))
          : ((this.x = Math.atan2(p, i)), (this.z = 0)))
      : "YXZ" === b
      ? ((this.x = Math.asin(-c(j))),
        0.99999 > Math.abs(j)
          ? ((this.y = Math.atan2(g, d)), (this.z = Math.atan2(h, i)))
          : ((this.y = Math.atan2(-m, e)), (this.z = 0)))
      : "ZXY" === b
      ? ((this.x = Math.asin(c(p))),
        0.99999 > Math.abs(p)
          ? ((this.y = Math.atan2(-m, d)), (this.z = Math.atan2(-f, i)))
          : ((this.y = 0), (this.z = Math.atan2(h, e))))
      : "ZYX" === b
      ? ((this.y = Math.asin(-c(m))),
        0.99999 > Math.abs(m)
          ? ((this.x = Math.atan2(p, d)), (this.z = Math.atan2(h, e)))
          : ((this.x = 0), (this.z = Math.atan2(-f, i))))
      : "YZX" === b
      ? ((this.z = Math.asin(c(h))),
        0.99999 > Math.abs(h)
          ? ((this.x = Math.atan2(-j, i)), (this.y = Math.atan2(-m, e)))
          : ((this.x = 0), (this.y = Math.atan2(g, d))))
      : "XZY" === b &&
        ((this.z = Math.asin(-c(f))),
        0.99999 > Math.abs(f)
          ? ((this.x = Math.atan2(p, i)), (this.y = Math.atan2(g, e)))
          : ((this.x = Math.atan2(-j, d)), (this.y = 0)));
    return this;
  },
  setEulerFromQuaternion: function (a, b) {
    function c(a) {
      return Math.min(Math.max(a, -1), 1);
    }
    var d = a.x * a.x,
      e = a.y * a.y,
      f = a.z * a.z,
      g = a.w * a.w;
    void 0 === b || "XYZ" === b
      ? ((this.x = Math.atan2(2 * (a.x * a.w - a.y * a.z), g - d - e + f)),
        (this.y = Math.asin(c(2 * (a.x * a.z + a.y * a.w)))),
        (this.z = Math.atan2(2 * (a.z * a.w - a.x * a.y), g + d - e - f)))
      : "YXZ" === b
      ? ((this.x = Math.asin(c(2 * (a.x * a.w - a.y * a.z)))),
        (this.y = Math.atan2(2 * (a.x * a.z + a.y * a.w), g - d - e + f)),
        (this.z = Math.atan2(2 * (a.x * a.y + a.z * a.w), g - d + e - f)))
      : "ZXY" === b
      ? ((this.x = Math.asin(c(2 * (a.x * a.w + a.y * a.z)))),
        (this.y = Math.atan2(2 * (a.y * a.w - a.z * a.x), g - d - e + f)),
        (this.z = Math.atan2(2 * (a.z * a.w - a.x * a.y), g - d + e - f)))
      : "ZYX" === b
      ? ((this.x = Math.atan2(2 * (a.x * a.w + a.z * a.y), g - d - e + f)),
        (this.y = Math.asin(c(2 * (a.y * a.w - a.x * a.z)))),
        (this.z = Math.atan2(2 * (a.x * a.y + a.z * a.w), g + d - e - f)))
      : "YZX" === b
      ? ((this.x = Math.atan2(2 * (a.x * a.w - a.z * a.y), g - d + e - f)),
        (this.y = Math.atan2(2 * (a.y * a.w - a.x * a.z), g + d - e - f)),
        (this.z = Math.asin(c(2 * (a.x * a.y + a.z * a.w)))))
      : "XZY" === b &&
        ((this.x = Math.atan2(2 * (a.x * a.w + a.y * a.z), g - d + e - f)),
        (this.y = Math.atan2(2 * (a.x * a.z + a.y * a.w), g + d - e - f)),
        (this.z = Math.asin(c(2 * (a.z * a.w - a.x * a.y)))));
    return this;
  },
  getPositionFromMatrix: function (a) {
    this.x = a.elements[12];
    this.y = a.elements[13];
    this.z = a.elements[14];
    return this;
  },
  getScaleFromMatrix: function (a) {
    var b = this.set(a.elements[0], a.elements[1], a.elements[2]).length(),
      c = this.set(a.elements[4], a.elements[5], a.elements[6]).length(),
      a = this.set(a.elements[8], a.elements[9], a.elements[10]).length();
    this.x = b;
    this.y = c;
    this.z = a;
    return this;
  },
  getColumnFromMatrix: function (a, b) {
    var c = 4 * a,
      d = b.elements;
    this.x = d[c];
    this.y = d[c + 1];
    this.z = d[c + 2];
    return this;
  },
  equals: function (a) {
    return a.x === this.x && a.y === this.y && a.z === this.z;
  },
  fromArray: function (a) {
    this.x = a[0];
    this.y = a[1];
    this.z = a[2];
    return this;
  },
  toArray: function () {
    return [this.x, this.y, this.z];
  },
  clone: function () {
    return new THREE.Vector3(this.x, this.y, this.z);
  },
};
THREE.extend(THREE.Vector3.prototype, {
  applyEuler: (function () {
    var a = new THREE.Quaternion();
    return function (b, c) {
      var d = a.setFromEuler(b, c);
      this.applyQuaternion(d);
      return this;
    };
  })(),
  applyAxisAngle: (function () {
    var a = new THREE.Quaternion();
    return function (b, c) {
      var d = a.setFromAxisAngle(b, c);
      this.applyQuaternion(d);
      return this;
    };
  })(),
  projectOnVector: (function () {
    var a = new THREE.Vector3();
    return function (b) {
      a.copy(b).normalize();
      b = this.dot(a);
      return this.copy(a).multiplyScalar(b);
    };
  })(),
  projectOnPlane: (function () {
    var a = new THREE.Vector3();
    return function (b) {
      a.copy(this).projectOnVector(b);
      return this.sub(a);
    };
  })(),
  reflect: (function () {
    var a = new THREE.Vector3();
    return function (b) {
      a.copy(this).projectOnVector(b).multiplyScalar(2);
      return this.subVectors(a, this);
    };
  })(),
});
THREE.Vector4 = function (a, b, c, d) {
  this.x = a || 0;
  this.y = b || 0;
  this.z = c || 0;
  this.w = void 0 !== d ? d : 1;
};
THREE.Vector4.prototype = {
  constructor: THREE.Vector4,
  set: function (a, b, c, d) {
    this.x = a;
    this.y = b;
    this.z = c;
    this.w = d;
    return this;
  },
  setX: function (a) {
    this.x = a;
    return this;
  },
  setY: function (a) {
    this.y = a;
    return this;
  },
  setZ: function (a) {
    this.z = a;
    return this;
  },
  setW: function (a) {
    this.w = a;
    return this;
  },
  setComponent: function (a, b) {
    switch (a) {
      case 0:
        this.x = b;
        break;
      case 1:
        this.y = b;
        break;
      case 2:
        this.z = b;
        break;
      case 3:
        this.w = b;
        break;
      default:
        throw Error("index is out of range: " + a);
    }
  },
  getComponent: function (a) {
    switch (a) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      case 2:
        return this.z;
      case 3:
        return this.w;
      default:
        throw Error("index is out of range: " + a);
    }
  },
  copy: function (a) {
    this.x = a.x;
    this.y = a.y;
    this.z = a.z;
    this.w = void 0 !== a.w ? a.w : 1;
    return this;
  },
  add: function (a, b) {
    if (void 0 !== b)
      return (
        console.warn(
          "DEPRECATED: Vector4's .add() now only accepts one argument. Use .addVectors( a, b ) instead."
        ),
        this.addVectors(a, b)
      );
    this.x += a.x;
    this.y += a.y;
    this.z += a.z;
    this.w += a.w;
    return this;
  },
  addScalar: function (a) {
    this.x += a;
    this.y += a;
    this.z += a;
    this.w += a;
    return this;
  },
  addVectors: function (a, b) {
    this.x = a.x + b.x;
    this.y = a.y + b.y;
    this.z = a.z + b.z;
    this.w = a.w + b.w;
    return this;
  },
  sub: function (a, b) {
    if (void 0 !== b)
      return (
        console.warn(
          "DEPRECATED: Vector4's .sub() now only accepts one argument. Use .subVectors( a, b ) instead."
        ),
        this.subVectors(a, b)
      );
    this.x -= a.x;
    this.y -= a.y;
    this.z -= a.z;
    this.w -= a.w;
    return this;
  },
  subVectors: function (a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    this.w = a.w - b.w;
    return this;
  },
  multiplyScalar: function (a) {
    this.x *= a;
    this.y *= a;
    this.z *= a;
    this.w *= a;
    return this;
  },
  applyMatrix4: function (a) {
    var b = this.x,
      c = this.y,
      d = this.z,
      e = this.w,
      a = a.elements;
    this.x = a[0] * b + a[4] * c + a[8] * d + a[12] * e;
    this.y = a[1] * b + a[5] * c + a[9] * d + a[13] * e;
    this.z = a[2] * b + a[6] * c + a[10] * d + a[14] * e;
    this.w = a[3] * b + a[7] * c + a[11] * d + a[15] * e;
    return this;
  },
  divideScalar: function (a) {
    0 !== a
      ? ((this.x /= a), (this.y /= a), (this.z /= a), (this.w /= a))
      : ((this.z = this.y = this.x = 0), (this.w = 1));
    return this;
  },
  setAxisAngleFromQuaternion: function (a) {
    this.w = 2 * Math.acos(a.w);
    var b = Math.sqrt(1 - a.w * a.w);
    1e-4 > b
      ? ((this.x = 1), (this.z = this.y = 0))
      : ((this.x = a.x / b), (this.y = a.y / b), (this.z = a.z / b));
    return this;
  },
  setAxisAngleFromRotationMatrix: function (a) {
    var b,
      c,
      d,
      a = a.elements,
      e = a[0];
    d = a[4];
    var f = a[8],
      g = a[1],
      h = a[5],
      i = a[9];
    c = a[2];
    b = a[6];
    var j = a[10];
    if (
      0.01 > Math.abs(d - g) &&
      0.01 > Math.abs(f - c) &&
      0.01 > Math.abs(i - b)
    ) {
      if (
        0.1 > Math.abs(d + g) &&
        0.1 > Math.abs(f + c) &&
        0.1 > Math.abs(i + b) &&
        0.1 > Math.abs(e + h + j - 3)
      )
        return this.set(1, 0, 0, 0), this;
      a = Math.PI;
      e = (e + 1) / 2;
      h = (h + 1) / 2;
      j = (j + 1) / 2;
      d = (d + g) / 4;
      f = (f + c) / 4;
      i = (i + b) / 4;
      e > h && e > j
        ? 0.01 > e
          ? ((b = 0), (d = c = 0.707106781))
          : ((b = Math.sqrt(e)), (c = d / b), (d = f / b))
        : h > j
        ? 0.01 > h
          ? ((b = 0.707106781), (c = 0), (d = 0.707106781))
          : ((c = Math.sqrt(h)), (b = d / c), (d = i / c))
        : 0.01 > j
        ? ((c = b = 0.707106781), (d = 0))
        : ((d = Math.sqrt(j)), (b = f / d), (c = i / d));
      this.set(b, c, d, a);
      return this;
    }
    a = Math.sqrt((b - i) * (b - i) + (f - c) * (f - c) + (g - d) * (g - d));
    0.001 > Math.abs(a) && (a = 1);
    this.x = (b - i) / a;
    this.y = (f - c) / a;
    this.z = (g - d) / a;
    this.w = Math.acos((e + h + j - 1) / 2);
    return this;
  },
  min: function (a) {
    this.x > a.x && (this.x = a.x);
    this.y > a.y && (this.y = a.y);
    this.z > a.z && (this.z = a.z);
    this.w > a.w && (this.w = a.w);
    return this;
  },
  max: function (a) {
    this.x < a.x && (this.x = a.x);
    this.y < a.y && (this.y = a.y);
    this.z < a.z && (this.z = a.z);
    this.w < a.w && (this.w = a.w);
    return this;
  },
  clamp: function (a, b) {
    this.x < a.x ? (this.x = a.x) : this.x > b.x && (this.x = b.x);
    this.y < a.y ? (this.y = a.y) : this.y > b.y && (this.y = b.y);
    this.z < a.z ? (this.z = a.z) : this.z > b.z && (this.z = b.z);
    this.w < a.w ? (this.w = a.w) : this.w > b.w && (this.w = b.w);
    return this;
  },
  negate: function () {
    return this.multiplyScalar(-1);
  },
  dot: function (a) {
    return this.x * a.x + this.y * a.y + this.z * a.z + this.w * a.w;
  },
  lengthSq: function () {
    return (
      this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w
    );
  },
  length: function () {
    return Math.sqrt(
      this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w
    );
  },
  lengthManhattan: function () {
    return (
      Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z) + Math.abs(this.w)
    );
  },
  normalize: function () {
    return this.divideScalar(this.length());
  },
  setLength: function (a) {
    var b = this.length();
    0 !== b && a !== b && this.multiplyScalar(a / b);
    return this;
  },
  lerp: function (a, b) {
    this.x += (a.x - this.x) * b;
    this.y += (a.y - this.y) * b;
    this.z += (a.z - this.z) * b;
    this.w += (a.w - this.w) * b;
    return this;
  },
  equals: function (a) {
    return a.x === this.x && a.y === this.y && a.z === this.z && a.w === this.w;
  },
  fromArray: function (a) {
    this.x = a[0];
    this.y = a[1];
    this.z = a[2];
    this.w = a[3];
    return this;
  },
  toArray: function () {
    return [this.x, this.y, this.z, this.w];
  },
  clone: function () {
    return new THREE.Vector4(this.x, this.y, this.z, this.w);
  },
};
THREE.Line3 = function (a, b) {
  this.start = void 0 !== a ? a : new THREE.Vector3();
  this.end = void 0 !== b ? b : new THREE.Vector3();
};
THREE.Line3.prototype = {
  constructor: THREE.Line3,
  set: function (a, b) {
    this.start.copy(a);
    this.end.copy(b);
    return this;
  },
  copy: function (a) {
    this.start.copy(a.start);
    this.end.copy(a.end);
    return this;
  },
  center: function (a) {
    return (a || new THREE.Vector3())
      .addVectors(this.start, this.end)
      .multiplyScalar(0.5);
  },
  delta: function (a) {
    return (a || new THREE.Vector3()).subVectors(this.end, this.start);
  },
  distanceSq: function () {
    return this.start.distanceToSquared(this.end);
  },
  distance: function () {
    return this.start.distanceTo(this.end);
  },
  at: function (a, b) {
    var c = b || new THREE.Vector3();
    return this.delta(c).multiplyScalar(a).add(this.start);
  },
  closestPointToPointParameter: (function () {
    var a = new THREE.Vector3(),
      b = new THREE.Vector3();
    return function (c, d) {
      a.subVectors(c, this.start);
      b.subVectors(this.end, this.start);
      var e = b.dot(b),
        e = b.dot(a) / e;
      d && (e = THREE.Math.clamp(e, 0, 1));
      return e;
    };
  })(),
  closestPointToPoint: function (a, b, c) {
    a = this.closestPointToPointParameter(a, b);
    c = c || new THREE.Vector3();
    return this.delta(c).multiplyScalar(a).add(this.start);
  },
  applyMatrix4: function (a) {
    this.start.applyMatrix4(a);
    this.end.applyMatrix4(a);
    return this;
  },
  equals: function (a) {
    return a.start.equals(this.start) && a.end.equals(this.end);
  },
  clone: function () {
    return new THREE.Line3().copy(this);
  },
};
THREE.Box2 = function (a, b) {
  this.min = void 0 !== a ? a : new THREE.Vector2(Infinity, Infinity);
  this.max = void 0 !== b ? b : new THREE.Vector2(-Infinity, -Infinity);
};
THREE.Box2.prototype = {
  constructor: THREE.Box2,
  set: function (a, b) {
    this.min.copy(a);
    this.max.copy(b);
    return this;
  },
  setFromPoints: function (a) {
    if (0 < a.length) {
      var b = a[0];
      this.min.copy(b);
      this.max.copy(b);
      for (var c = 1, d = a.length; c < d; c++)
        (b = a[c]),
          b.x < this.min.x
            ? (this.min.x = b.x)
            : b.x > this.max.x && (this.max.x = b.x),
          b.y < this.min.y
            ? (this.min.y = b.y)
            : b.y > this.max.y && (this.max.y = b.y);
    } else this.makeEmpty();
    return this;
  },
  setFromCenterAndSize: (function () {
    var a = new THREE.Vector2();
    return function (b, c) {
      var d = a.copy(c).multiplyScalar(0.5);
      this.min.copy(b).sub(d);
      this.max.copy(b).add(d);
      return this;
    };
  })(),
  copy: function (a) {
    this.min.copy(a.min);
    this.max.copy(a.max);
    return this;
  },
  makeEmpty: function () {
    this.min.x = this.min.y = Infinity;
    this.max.x = this.max.y = -Infinity;
    return this;
  },
  empty: function () {
    return this.max.x < this.min.x || this.max.y < this.min.y;
  },
  center: function (a) {
    return (a || new THREE.Vector2())
      .addVectors(this.min, this.max)
      .multiplyScalar(0.5);
  },
  size: function (a) {
    return (a || new THREE.Vector2()).subVectors(this.max, this.min);
  },
  expandByPoint: function (a) {
    this.min.min(a);
    this.max.max(a);
    return this;
  },
  expandByVector: function (a) {
    this.min.sub(a);
    this.max.add(a);
    return this;
  },
  expandByScalar: function (a) {
    this.min.addScalar(-a);
    this.max.addScalar(a);
    return this;
  },
  containsPoint: function (a) {
    return a.x < this.min.x ||
      a.x > this.max.x ||
      a.y < this.min.y ||
      a.y > this.max.y
      ? !1
      : !0;
  },
  containsBox: function (a) {
    return this.min.x <= a.min.x &&
      a.max.x <= this.max.x &&
      this.min.y <= a.min.y &&
      a.max.y <= this.max.y
      ? !0
      : !1;
  },
  getParameter: function (a) {
    return new THREE.Vector2(
      (a.x - this.min.x) / (this.max.x - this.min.x),
      (a.y - this.min.y) / (this.max.y - this.min.y)
    );
  },
  isIntersectionBox: function (a) {
    return a.max.x < this.min.x ||
      a.min.x > this.max.x ||
      a.max.y < this.min.y ||
      a.min.y > this.max.y
      ? !1
      : !0;
  },
  clampPoint: function (a, b) {
    return (b || new THREE.Vector2()).copy(a).clamp(this.min, this.max);
  },
  distanceToPoint: (function () {
    var a = new THREE.Vector2();
    return function (b) {
      return a.copy(b).clamp(this.min, this.max).sub(b).length();
    };
  })(),
  intersect: function (a) {
    this.min.max(a.min);
    this.max.min(a.max);
    return this;
  },
  union: function (a) {
    this.min.min(a.min);
    this.max.max(a.max);
    return this;
  },
  translate: function (a) {
    this.min.add(a);
    this.max.add(a);
    return this;
  },
  equals: function (a) {
    return a.min.equals(this.min) && a.max.equals(this.max);
  },
  clone: function () {
    return new THREE.Box2().copy(this);
  },
};
THREE.Box3 = function (a, b) {
  this.min = void 0 !== a ? a : new THREE.Vector3(Infinity, Infinity, Infinity);
  this.max =
    void 0 !== b ? b : new THREE.Vector3(-Infinity, -Infinity, -Infinity);
};
THREE.Box3.prototype = {
  constructor: THREE.Box3,
  set: function (a, b) {
    this.min.copy(a);
    this.max.copy(b);
    return this;
  },
  setFromPoints: function (a) {
    if (0 < a.length) {
      var b = a[0];
      this.min.copy(b);
      this.max.copy(b);
      for (var c = 1, d = a.length; c < d; c++)
        (b = a[c]),
          b.x < this.min.x
            ? (this.min.x = b.x)
            : b.x > this.max.x && (this.max.x = b.x),
          b.y < this.min.y
            ? (this.min.y = b.y)
            : b.y > this.max.y && (this.max.y = b.y),
          b.z < this.min.z
            ? (this.min.z = b.z)
            : b.z > this.max.z && (this.max.z = b.z);
    } else this.makeEmpty();
    return this;
  },
  setFromCenterAndSize: (function () {
    var a = new THREE.Vector3();
    return function (b, c) {
      var d = a.copy(c).multiplyScalar(0.5);
      this.min.copy(b).sub(d);
      this.max.copy(b).add(d);
      return this;
    };
  })(),
  copy: function (a) {
    this.min.copy(a.min);
    this.max.copy(a.max);
    return this;
  },
  makeEmpty: function () {
    this.min.x = this.min.y = this.min.z = Infinity;
    this.max.x = this.max.y = this.max.z = -Infinity;
    return this;
  },
  empty: function () {
    return (
      this.max.x < this.min.x ||
      this.max.y < this.min.y ||
      this.max.z < this.min.z
    );
  },
  center: function (a) {
    return (a || new THREE.Vector3())
      .addVectors(this.min, this.max)
      .multiplyScalar(0.5);
  },
  size: function (a) {
    return (a || new THREE.Vector3()).subVectors(this.max, this.min);
  },
  expandByPoint: function (a) {
    this.min.min(a);
    this.max.max(a);
    return this;
  },
  expandByVector: function (a) {
    this.min.sub(a);
    this.max.add(a);
    return this;
  },
  expandByScalar: function (a) {
    this.min.addScalar(-a);
    this.max.addScalar(a);
    return this;
  },
  containsPoint: function (a) {
    return a.x < this.min.x ||
      a.x > this.max.x ||
      a.y < this.min.y ||
      a.y > this.max.y ||
      a.z < this.min.z ||
      a.z > this.max.z
      ? !1
      : !0;
  },
  containsBox: function (a) {
    return this.min.x <= a.min.x &&
      a.max.x <= this.max.x &&
      this.min.y <= a.min.y &&
      a.max.y <= this.max.y &&
      this.min.z <= a.min.z &&
      a.max.z <= this.max.z
      ? !0
      : !1;
  },
  getParameter: function (a) {
    return new THREE.Vector3(
      (a.x - this.min.x) / (this.max.x - this.min.x),
      (a.y - this.min.y) / (this.max.y - this.min.y),
      (a.z - this.min.z) / (this.max.z - this.min.z)
    );
  },
  isIntersectionBox: function (a) {
    return a.max.x < this.min.x ||
      a.min.x > this.max.x ||
      a.max.y < this.min.y ||
      a.min.y > this.max.y ||
      a.max.z < this.min.z ||
      a.min.z > this.max.z
      ? !1
      : !0;
  },
  clampPoint: function (a, b) {
    return (b || new THREE.Vector3()).copy(a).clamp(this.min, this.max);
  },
  distanceToPoint: (function () {
    var a = new THREE.Vector3();
    return function (b) {
      return a.copy(b).clamp(this.min, this.max).sub(b).length();
    };
  })(),
  getBoundingSphere: (function () {
    var a = new THREE.Vector3();
    return function (b) {
      b = b || new THREE.Sphere();
      b.center = this.center();
      b.radius = 0.5 * this.size(a).length();
      return b;
    };
  })(),
  intersect: function (a) {
    this.min.max(a.min);
    this.max.min(a.max);
    return this;
  },
  union: function (a) {
    this.min.min(a.min);
    this.max.max(a.max);
    return this;
  },
  applyMatrix4: (function () {
    var a = [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ];
    return function (b) {
      a[0].set(this.min.x, this.min.y, this.min.z).applyMatrix4(b);
      a[1].set(this.min.x, this.min.y, this.max.z).applyMatrix4(b);
      a[2].set(this.min.x, this.max.y, this.min.z).applyMatrix4(b);
      a[3].set(this.min.x, this.max.y, this.max.z).applyMatrix4(b);
      a[4].set(this.max.x, this.min.y, this.min.z).applyMatrix4(b);
      a[5].set(this.max.x, this.min.y, this.max.z).applyMatrix4(b);
      a[6].set(this.max.x, this.max.y, this.min.z).applyMatrix4(b);
      a[7].set(this.max.x, this.max.y, this.max.z).applyMatrix4(b);
      this.makeEmpty();
      this.setFromPoints(a);
      return this;
    };
  })(),
  translate: function (a) {
    this.min.add(a);
    this.max.add(a);
    return this;
  },
  equals: function (a) {
    return a.min.equals(this.min) && a.max.equals(this.max);
  },
  clone: function () {
    return new THREE.Box3().copy(this);
  },
};
THREE.Matrix3 = function (a, b, c, d, e, f, g, h, i) {
  this.elements = new Float32Array(9);
  this.set(
    void 0 !== a ? a : 1,
    b || 0,
    c || 0,
    d || 0,
    void 0 !== e ? e : 1,
    f || 0,
    g || 0,
    h || 0,
    void 0 !== i ? i : 1
  );
};
THREE.Matrix3.prototype = {
  constructor: THREE.Matrix3,
  set: function (a, b, c, d, e, f, g, h, i) {
    var j = this.elements;
    j[0] = a;
    j[3] = b;
    j[6] = c;
    j[1] = d;
    j[4] = e;
    j[7] = f;
    j[2] = g;
    j[5] = h;
    j[8] = i;
    return this;
  },
  identity: function () {
    this.set(1, 0, 0, 0, 1, 0, 0, 0, 1);
    return this;
  },
  copy: function (a) {
    a = a.elements;
    this.set(a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]);
    return this;
  },
  multiplyVector3: function (a) {
    console.warn(
      "DEPRECATED: Matrix3's .multiplyVector3() has been removed. Use vector.applyMatrix3( matrix ) instead."
    );
    return a.applyMatrix3(this);
  },
  multiplyVector3Array: (function () {
    var a = new THREE.Vector3();
    return function (b) {
      for (var c = 0, d = b.length; c < d; c += 3)
        (a.x = b[c]),
          (a.y = b[c + 1]),
          (a.z = b[c + 2]),
          a.applyMatrix3(this),
          (b[c] = a.x),
          (b[c + 1] = a.y),
          (b[c + 2] = a.z);
      return b;
    };
  })(),
  multiplyScalar: function (a) {
    var b = this.elements;
    b[0] *= a;
    b[3] *= a;
    b[6] *= a;
    b[1] *= a;
    b[4] *= a;
    b[7] *= a;
    b[2] *= a;
    b[5] *= a;
    b[8] *= a;
    return this;
  },
  determinant: function () {
    var a = this.elements,
      b = a[0],
      c = a[1],
      d = a[2],
      e = a[3],
      f = a[4],
      g = a[5],
      h = a[6],
      i = a[7],
      a = a[8];
    return (
      b * f * a - b * g * i - c * e * a + c * g * h + d * e * i - d * f * h
    );
  },
  getInverse: function (a, b) {
    var c = a.elements,
      d = this.elements;
    d[0] = c[10] * c[5] - c[6] * c[9];
    d[1] = -c[10] * c[1] + c[2] * c[9];
    d[2] = c[6] * c[1] - c[2] * c[5];
    d[3] = -c[10] * c[4] + c[6] * c[8];
    d[4] = c[10] * c[0] - c[2] * c[8];
    d[5] = -c[6] * c[0] + c[2] * c[4];
    d[6] = c[9] * c[4] - c[5] * c[8];
    d[7] = -c[9] * c[0] + c[1] * c[8];
    d[8] = c[5] * c[0] - c[1] * c[4];
    c = c[0] * d[0] + c[1] * d[3] + c[2] * d[6];
    if (0 === c) {
      if (b)
        throw Error(
          "Matrix3.getInverse(): can't invert matrix, determinant is 0"
        );
      console.warn(
        "Matrix3.getInverse(): can't invert matrix, determinant is 0"
      );
      this.identity();
      return this;
    }
    this.multiplyScalar(1 / c);
    return this;
  },
  transpose: function () {
    var a,
      b = this.elements;
    a = b[1];
    b[1] = b[3];
    b[3] = a;
    a = b[2];
    b[2] = b[6];
    b[6] = a;
    a = b[5];
    b[5] = b[7];
    b[7] = a;
    return this;
  },
  getNormalMatrix: function (a) {
    this.getInverse(a).transpose();
    return this;
  },
  transposeIntoArray: function (a) {
    var b = this.elements;
    a[0] = b[0];
    a[1] = b[3];
    a[2] = b[6];
    a[3] = b[1];
    a[4] = b[4];
    a[5] = b[7];
    a[6] = b[2];
    a[7] = b[5];
    a[8] = b[8];
    return this;
  },
  clone: function () {
    var a = this.elements;
    return new THREE.Matrix3(
      a[0],
      a[3],
      a[6],
      a[1],
      a[4],
      a[7],
      a[2],
      a[5],
      a[8]
    );
  },
};
THREE.Matrix4 = function (a, b, c, d, e, f, g, h, i, j, m, p, l, r, s, n) {
  var q = (this.elements = new Float32Array(16));
  q[0] = void 0 !== a ? a : 1;
  q[4] = b || 0;
  q[8] = c || 0;
  q[12] = d || 0;
  q[1] = e || 0;
  q[5] = void 0 !== f ? f : 1;
  q[9] = g || 0;
  q[13] = h || 0;
  q[2] = i || 0;
  q[6] = j || 0;
  q[10] = void 0 !== m ? m : 1;
  q[14] = p || 0;
  q[3] = l || 0;
  q[7] = r || 0;
  q[11] = s || 0;
  q[15] = void 0 !== n ? n : 1;
};
THREE.Matrix4.prototype = {
  constructor: THREE.Matrix4,
  set: function (a, b, c, d, e, f, g, h, i, j, m, p, l, r, s, n) {
    var q = this.elements;
    q[0] = a;
    q[4] = b;
    q[8] = c;
    q[12] = d;
    q[1] = e;
    q[5] = f;
    q[9] = g;
    q[13] = h;
    q[2] = i;
    q[6] = j;
    q[10] = m;
    q[14] = p;
    q[3] = l;
    q[7] = r;
    q[11] = s;
    q[15] = n;
    return this;
  },
  identity: function () {
    this.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    return this;
  },
  copy: function (a) {
    a = a.elements;
    this.set(
      a[0],
      a[4],
      a[8],
      a[12],
      a[1],
      a[5],
      a[9],
      a[13],
      a[2],
      a[6],
      a[10],
      a[14],
      a[3],
      a[7],
      a[11],
      a[15]
    );
    return this;
  },
  extractPosition: function (a) {
    console.warn(
      "DEPRECATED: Matrix4's .extractPosition() has been renamed to .copyPosition()."
    );
    return this.copyPosition(a);
  },
  copyPosition: function (a) {
    var b = this.elements,
      a = a.elements;
    b[12] = a[12];
    b[13] = a[13];
    b[14] = a[14];
    return this;
  },
  extractRotation: (function () {
    var a = new THREE.Vector3();
    return function (b) {
      var c = this.elements,
        b = b.elements,
        d = 1 / a.set(b[0], b[1], b[2]).length(),
        e = 1 / a.set(b[4], b[5], b[6]).length(),
        f = 1 / a.set(b[8], b[9], b[10]).length();
      c[0] = b[0] * d;
      c[1] = b[1] * d;
      c[2] = b[2] * d;
      c[4] = b[4] * e;
      c[5] = b[5] * e;
      c[6] = b[6] * e;
      c[8] = b[8] * f;
      c[9] = b[9] * f;
      c[10] = b[10] * f;
      return this;
    };
  })(),
  setRotationFromEuler: function (a, b) {
    console.warn(
      "DEPRECATED: Matrix4's .setRotationFromEuler() has been deprecated in favor of makeRotationFromEuler.  Please update your code."
    );
    return this.makeRotationFromEuler(a, b);
  },
  makeRotationFromEuler: function (a, b) {
    var c = this.elements,
      d = a.x,
      e = a.y,
      f = a.z,
      g = Math.cos(d),
      d = Math.sin(d),
      h = Math.cos(e),
      e = Math.sin(e),
      i = Math.cos(f),
      f = Math.sin(f);
    if (void 0 === b || "XYZ" === b) {
      var j = g * i,
        m = g * f,
        p = d * i,
        l = d * f;
      c[0] = h * i;
      c[4] = -h * f;
      c[8] = e;
      c[1] = m + p * e;
      c[5] = j - l * e;
      c[9] = -d * h;
      c[2] = l - j * e;
      c[6] = p + m * e;
      c[10] = g * h;
    } else
      "YXZ" === b
        ? ((j = h * i),
          (m = h * f),
          (p = e * i),
          (l = e * f),
          (c[0] = j + l * d),
          (c[4] = p * d - m),
          (c[8] = g * e),
          (c[1] = g * f),
          (c[5] = g * i),
          (c[9] = -d),
          (c[2] = m * d - p),
          (c[6] = l + j * d),
          (c[10] = g * h))
        : "ZXY" === b
        ? ((j = h * i),
          (m = h * f),
          (p = e * i),
          (l = e * f),
          (c[0] = j - l * d),
          (c[4] = -g * f),
          (c[8] = p + m * d),
          (c[1] = m + p * d),
          (c[5] = g * i),
          (c[9] = l - j * d),
          (c[2] = -g * e),
          (c[6] = d),
          (c[10] = g * h))
        : "ZYX" === b
        ? ((j = g * i),
          (m = g * f),
          (p = d * i),
          (l = d * f),
          (c[0] = h * i),
          (c[4] = p * e - m),
          (c[8] = j * e + l),
          (c[1] = h * f),
          (c[5] = l * e + j),
          (c[9] = m * e - p),
          (c[2] = -e),
          (c[6] = d * h),
          (c[10] = g * h))
        : "YZX" === b
        ? ((j = g * h),
          (m = g * e),
          (p = d * h),
          (l = d * e),
          (c[0] = h * i),
          (c[4] = l - j * f),
          (c[8] = p * f + m),
          (c[1] = f),
          (c[5] = g * i),
          (c[9] = -d * i),
          (c[2] = -e * i),
          (c[6] = m * f + p),
          (c[10] = j - l * f))
        : "XZY" === b &&
          ((j = g * h),
          (m = g * e),
          (p = d * h),
          (l = d * e),
          (c[0] = h * i),
          (c[4] = -f),
          (c[8] = e * i),
          (c[1] = j * f + l),
          (c[5] = g * i),
          (c[9] = m * f - p),
          (c[2] = p * f - m),
          (c[6] = d * i),
          (c[10] = l * f + j));
    c[3] = 0;
    c[7] = 0;
    c[11] = 0;
    c[12] = 0;
    c[13] = 0;
    c[14] = 0;
    c[15] = 1;
    return this;
  },
  setRotationFromQuaternion: function (a) {
    console.warn(
      "DEPRECATED: Matrix4's .setRotationFromQuaternion() has been deprecated in favor of makeRotationFromQuaternion.  Please update your code."
    );
    return this.makeRotationFromQuaternion(a);
  },
  makeRotationFromQuaternion: function (a) {
    var b = this.elements,
      c = a.x,
      d = a.y,
      e = a.z,
      f = a.w,
      g = c + c,
      h = d + d,
      i = e + e,
      a = c * g,
      j = c * h,
      c = c * i,
      m = d * h,
      d = d * i,
      e = e * i,
      g = f * g,
      h = f * h,
      f = f * i;
    b[0] = 1 - (m + e);
    b[4] = j - f;
    b[8] = c + h;
    b[1] = j + f;
    b[5] = 1 - (a + e);
    b[9] = d - g;
    b[2] = c - h;
    b[6] = d + g;
    b[10] = 1 - (a + m);
    b[3] = 0;
    b[7] = 0;
    b[11] = 0;
    b[12] = 0;
    b[13] = 0;
    b[14] = 0;
    b[15] = 1;
    return this;
  },
  lookAt: (function () {
    var a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3();
    return function (d, e, f) {
      var g = this.elements;
      c.subVectors(d, e).normalize();
      0 === c.length() && (c.z = 1);
      a.crossVectors(f, c).normalize();
      0 === a.length() && ((c.x += 1e-4), a.crossVectors(f, c).normalize());
      b.crossVectors(c, a);
      g[0] = a.x;
      g[4] = b.x;
      g[8] = c.x;
      g[1] = a.y;
      g[5] = b.y;
      g[9] = c.y;
      g[2] = a.z;
      g[6] = b.z;
      g[10] = c.z;
      return this;
    };
  })(),
  multiply: function (a, b) {
    return void 0 !== b
      ? (console.warn(
          "DEPRECATED: Matrix4's .multiply() now only accepts one argument. Use .multiplyMatrices( a, b ) instead."
        ),
        this.multiplyMatrices(a, b))
      : this.multiplyMatrices(this, a);
  },
  multiplyMatrices: function (a, b) {
    var c = a.elements,
      d = b.elements,
      e = this.elements,
      f = c[0],
      g = c[4],
      h = c[8],
      i = c[12],
      j = c[1],
      m = c[5],
      p = c[9],
      l = c[13],
      r = c[2],
      s = c[6],
      n = c[10],
      q = c[14],
      y = c[3],
      u = c[7],
      x = c[11],
      c = c[15],
      t = d[0],
      E = d[4],
      J = d[8],
      F = d[12],
      z = d[1],
      H = d[5],
      K = d[9],
      G = d[13],
      L = d[2],
      B = d[6],
      V = d[10],
      C = d[14],
      I = d[3],
      M = d[7],
      R = d[11],
      d = d[15];
    e[0] = f * t + g * z + h * L + i * I;
    e[4] = f * E + g * H + h * B + i * M;
    e[8] = f * J + g * K + h * V + i * R;
    e[12] = f * F + g * G + h * C + i * d;
    e[1] = j * t + m * z + p * L + l * I;
    e[5] = j * E + m * H + p * B + l * M;
    e[9] = j * J + m * K + p * V + l * R;
    e[13] = j * F + m * G + p * C + l * d;
    e[2] = r * t + s * z + n * L + q * I;
    e[6] = r * E + s * H + n * B + q * M;
    e[10] = r * J + s * K + n * V + q * R;
    e[14] = r * F + s * G + n * C + q * d;
    e[3] = y * t + u * z + x * L + c * I;
    e[7] = y * E + u * H + x * B + c * M;
    e[11] = y * J + u * K + x * V + c * R;
    e[15] = y * F + u * G + x * C + c * d;
    return this;
  },
  multiplyToArray: function (a, b, c) {
    var d = this.elements;
    this.multiplyMatrices(a, b);
    c[0] = d[0];
    c[1] = d[1];
    c[2] = d[2];
    c[3] = d[3];
    c[4] = d[4];
    c[5] = d[5];
    c[6] = d[6];
    c[7] = d[7];
    c[8] = d[8];
    c[9] = d[9];
    c[10] = d[10];
    c[11] = d[11];
    c[12] = d[12];
    c[13] = d[13];
    c[14] = d[14];
    c[15] = d[15];
    return this;
  },
  multiplyScalar: function (a) {
    var b = this.elements;
    b[0] *= a;
    b[4] *= a;
    b[8] *= a;
    b[12] *= a;
    b[1] *= a;
    b[5] *= a;
    b[9] *= a;
    b[13] *= a;
    b[2] *= a;
    b[6] *= a;
    b[10] *= a;
    b[14] *= a;
    b[3] *= a;
    b[7] *= a;
    b[11] *= a;
    b[15] *= a;
    return this;
  },
  multiplyVector3: function (a) {
    console.warn(
      "DEPRECATED: Matrix4's .multiplyVector3() has been removed. Use vector.applyMatrix4( matrix ) or vector.applyProjection( matrix ) instead."
    );
    return a.applyProjection(this);
  },
  multiplyVector4: function (a) {
    console.warn(
      "DEPRECATED: Matrix4's .multiplyVector4() has been removed. Use vector.applyMatrix4( matrix ) instead."
    );
    return a.applyMatrix4(this);
  },
  multiplyVector3Array: (function () {
    var a = new THREE.Vector3();
    return function (b) {
      for (var c = 0, d = b.length; c < d; c += 3)
        (a.x = b[c]),
          (a.y = b[c + 1]),
          (a.z = b[c + 2]),
          a.applyProjection(this),
          (b[c] = a.x),
          (b[c + 1] = a.y),
          (b[c + 2] = a.z);
      return b;
    };
  })(),
  rotateAxis: function (a) {
    console.warn(
      "DEPRECATED: Matrix4's .rotateAxis() has been removed. Use Vector3.transformDirection( matrix ) instead."
    );
    a.transformDirection(this);
  },
  crossVector: function (a) {
    console.warn(
      "DEPRECATED: Matrix4's .crossVector() has been removed. Use vector.applyMatrix4( matrix ) instead."
    );
    return a.applyMatrix4(this);
  },
  determinant: function () {
    var a = this.elements,
      b = a[0],
      c = a[4],
      d = a[8],
      e = a[12],
      f = a[1],
      g = a[5],
      h = a[9],
      i = a[13],
      j = a[2],
      m = a[6],
      p = a[10],
      l = a[14];
    return (
      a[3] *
        (+e * h * m -
          d * i * m -
          e * g * p +
          c * i * p +
          d * g * l -
          c * h * l) +
      a[7] *
        (+b * h * l -
          b * i * p +
          e * f * p -
          d * f * l +
          d * i * j -
          e * h * j) +
      a[11] *
        (+b * i * m -
          b * g * l -
          e * f * m +
          c * f * l +
          e * g * j -
          c * i * j) +
      a[15] *
        (-d * g * j - b * h * m + b * g * p + d * f * m - c * f * p + c * h * j)
    );
  },
  transpose: function () {
    var a = this.elements,
      b;
    b = a[1];
    a[1] = a[4];
    a[4] = b;
    b = a[2];
    a[2] = a[8];
    a[8] = b;
    b = a[6];
    a[6] = a[9];
    a[9] = b;
    b = a[3];
    a[3] = a[12];
    a[12] = b;
    b = a[7];
    a[7] = a[13];
    a[13] = b;
    b = a[11];
    a[11] = a[14];
    a[14] = b;
    return this;
  },
  flattenToArray: function (a) {
    var b = this.elements;
    a[0] = b[0];
    a[1] = b[1];
    a[2] = b[2];
    a[3] = b[3];
    a[4] = b[4];
    a[5] = b[5];
    a[6] = b[6];
    a[7] = b[7];
    a[8] = b[8];
    a[9] = b[9];
    a[10] = b[10];
    a[11] = b[11];
    a[12] = b[12];
    a[13] = b[13];
    a[14] = b[14];
    a[15] = b[15];
    return a;
  },
  flattenToArrayOffset: function (a, b) {
    var c = this.elements;
    a[b] = c[0];
    a[b + 1] = c[1];
    a[b + 2] = c[2];
    a[b + 3] = c[3];
    a[b + 4] = c[4];
    a[b + 5] = c[5];
    a[b + 6] = c[6];
    a[b + 7] = c[7];
    a[b + 8] = c[8];
    a[b + 9] = c[9];
    a[b + 10] = c[10];
    a[b + 11] = c[11];
    a[b + 12] = c[12];
    a[b + 13] = c[13];
    a[b + 14] = c[14];
    a[b + 15] = c[15];
    return a;
  },
  getPosition: (function () {
    var a = new THREE.Vector3();
    return function () {
      console.warn(
        "DEPRECATED: Matrix4's .getPosition() has been removed. Use Vector3.getPositionFromMatrix( matrix ) instead."
      );
      var b = this.elements;
      return a.set(b[12], b[13], b[14]);
    };
  })(),
  setPosition: function (a) {
    var b = this.elements;
    b[12] = a.x;
    b[13] = a.y;
    b[14] = a.z;
    return this;
  },
  getInverse: function (a, b) {
    var c = this.elements,
      d = a.elements,
      e = d[0],
      f = d[4],
      g = d[8],
      h = d[12],
      i = d[1],
      j = d[5],
      m = d[9],
      p = d[13],
      l = d[2],
      r = d[6],
      s = d[10],
      n = d[14],
      q = d[3],
      y = d[7],
      u = d[11],
      x = d[15];
    c[0] =
      m * n * y - p * s * y + p * r * u - j * n * u - m * r * x + j * s * x;
    c[4] =
      h * s * y - g * n * y - h * r * u + f * n * u + g * r * x - f * s * x;
    c[8] =
      g * p * y - h * m * y + h * j * u - f * p * u - g * j * x + f * m * x;
    c[12] =
      h * m * r - g * p * r - h * j * s + f * p * s + g * j * n - f * m * n;
    c[1] =
      p * s * q - m * n * q - p * l * u + i * n * u + m * l * x - i * s * x;
    c[5] =
      g * n * q - h * s * q + h * l * u - e * n * u - g * l * x + e * s * x;
    c[9] =
      h * m * q - g * p * q - h * i * u + e * p * u + g * i * x - e * m * x;
    c[13] =
      g * p * l - h * m * l + h * i * s - e * p * s - g * i * n + e * m * n;
    c[2] =
      j * n * q - p * r * q + p * l * y - i * n * y - j * l * x + i * r * x;
    c[6] =
      h * r * q - f * n * q - h * l * y + e * n * y + f * l * x - e * r * x;
    c[10] =
      f * p * q - h * j * q + h * i * y - e * p * y - f * i * x + e * j * x;
    c[14] =
      h * j * l - f * p * l - h * i * r + e * p * r + f * i * n - e * j * n;
    c[3] =
      m * r * q - j * s * q - m * l * y + i * s * y + j * l * u - i * r * u;
    c[7] =
      f * s * q - g * r * q + g * l * y - e * s * y - f * l * u + e * r * u;
    c[11] =
      g * j * q - f * m * q - g * i * y + e * m * y + f * i * u - e * j * u;
    c[15] =
      f * m * l - g * j * l + g * i * r - e * m * r - f * i * s + e * j * s;
    c = d[0] * c[0] + d[1] * c[4] + d[2] * c[8] + d[3] * c[12];
    if (0 == c) {
      if (b)
        throw Error(
          "Matrix4.getInverse(): can't invert matrix, determinant is 0"
        );
      console.warn(
        "Matrix4.getInverse(): can't invert matrix, determinant is 0"
      );
      this.identity();
      return this;
    }
    this.multiplyScalar(1 / c);
    return this;
  },
  translate: function () {
    console.warn("DEPRECATED: Matrix4's .translate() has been removed.");
  },
  rotateX: function () {
    console.warn("DEPRECATED: Matrix4's .rotateX() has been removed.");
  },
  rotateY: function () {
    console.warn("DEPRECATED: Matrix4's .rotateY() has been removed.");
  },
  rotateZ: function () {
    console.warn("DEPRECATED: Matrix4's .rotateZ() has been removed.");
  },
  rotateByAxis: function () {
    console.warn("DEPRECATED: Matrix4's .rotateByAxis() has been removed.");
  },
  scale: function (a) {
    var b = this.elements,
      c = a.x,
      d = a.y,
      a = a.z;
    b[0] *= c;
    b[4] *= d;
    b[8] *= a;
    b[1] *= c;
    b[5] *= d;
    b[9] *= a;
    b[2] *= c;
    b[6] *= d;
    b[10] *= a;
    b[3] *= c;
    b[7] *= d;
    b[11] *= a;
    return this;
  },
  getMaxScaleOnAxis: function () {
    var a = this.elements;
    return Math.sqrt(
      Math.max(
        a[0] * a[0] + a[1] * a[1] + a[2] * a[2],
        Math.max(
          a[4] * a[4] + a[5] * a[5] + a[6] * a[6],
          a[8] * a[8] + a[9] * a[9] + a[10] * a[10]
        )
      )
    );
  },
  makeTranslation: function (a, b, c) {
    this.set(1, 0, 0, a, 0, 1, 0, b, 0, 0, 1, c, 0, 0, 0, 1);
    return this;
  },
  makeRotationX: function (a) {
    var b = Math.cos(a),
      a = Math.sin(a);
    this.set(1, 0, 0, 0, 0, b, -a, 0, 0, a, b, 0, 0, 0, 0, 1);
    return this;
  },
  makeRotationY: function (a) {
    var b = Math.cos(a),
      a = Math.sin(a);
    this.set(b, 0, a, 0, 0, 1, 0, 0, -a, 0, b, 0, 0, 0, 0, 1);
    return this;
  },
  makeRotationZ: function (a) {
    var b = Math.cos(a),
      a = Math.sin(a);
    this.set(b, -a, 0, 0, a, b, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    return this;
  },
  makeRotationAxis: function (a, b) {
    var c = Math.cos(b),
      d = Math.sin(b),
      e = 1 - c,
      f = a.x,
      g = a.y,
      h = a.z,
      i = e * f,
      j = e * g;
    this.set(
      i * f + c,
      i * g - d * h,
      i * h + d * g,
      0,
      i * g + d * h,
      j * g + c,
      j * h - d * f,
      0,
      i * h - d * g,
      j * h + d * f,
      e * h * h + c,
      0,
      0,
      0,
      0,
      1
    );
    return this;
  },
  makeScale: function (a, b, c) {
    this.set(a, 0, 0, 0, 0, b, 0, 0, 0, 0, c, 0, 0, 0, 0, 1);
    return this;
  },
  compose: function (a, b, c) {
    console.warn(
      "DEPRECATED: Matrix4's .compose() has been deprecated in favor of makeFromPositionQuaternionScale. Please update your code."
    );
    return this.makeFromPositionQuaternionScale(a, b, c);
  },
  makeFromPositionQuaternionScale: function (a, b, c) {
    this.makeRotationFromQuaternion(b);
    this.scale(c);
    this.setPosition(a);
    return this;
  },
  makeFromPositionEulerScale: function (a, b, c, d) {
    this.makeRotationFromEuler(b, c);
    this.scale(d);
    this.setPosition(a);
    return this;
  },
  makeFrustum: function (a, b, c, d, e, f) {
    var g = this.elements;
    g[0] = (2 * e) / (b - a);
    g[4] = 0;
    g[8] = (b + a) / (b - a);
    g[12] = 0;
    g[1] = 0;
    g[5] = (2 * e) / (d - c);
    g[9] = (d + c) / (d - c);
    g[13] = 0;
    g[2] = 0;
    g[6] = 0;
    g[10] = -(f + e) / (f - e);
    g[14] = (-2 * f * e) / (f - e);
    g[3] = 0;
    g[7] = 0;
    g[11] = -1;
    g[15] = 0;
    return this;
  },
  makePerspective: function (a, b, c, d) {
    var a = c * Math.tan(THREE.Math.degToRad(0.5 * a)),
      e = -a;
    return this.makeFrustum(e * b, a * b, e, a, c, d);
  },
  makeOrthographic: function (a, b, c, d, e, f) {
    var g = this.elements,
      h = b - a,
      i = c - d,
      j = f - e;
    g[0] = 2 / h;
    g[4] = 0;
    g[8] = 0;
    g[12] = -((b + a) / h);
    g[1] = 0;
    g[5] = 2 / i;
    g[9] = 0;
    g[13] = -((c + d) / i);
    g[2] = 0;
    g[6] = 0;
    g[10] = -2 / j;
    g[14] = -((f + e) / j);
    g[3] = 0;
    g[7] = 0;
    g[11] = 0;
    g[15] = 1;
    return this;
  },
  clone: function () {
    var a = this.elements;
    return new THREE.Matrix4(
      a[0],
      a[4],
      a[8],
      a[12],
      a[1],
      a[5],
      a[9],
      a[13],
      a[2],
      a[6],
      a[10],
      a[14],
      a[3],
      a[7],
      a[11],
      a[15]
    );
  },
};
THREE.extend(THREE.Matrix4.prototype, {
  decompose: (function () {
    var a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3(),
      d = new THREE.Matrix4();
    return function (e, f, g) {
      var h = this.elements;
      a.set(h[0], h[1], h[2]);
      b.set(h[4], h[5], h[6]);
      c.set(h[8], h[9], h[10]);
      e = e instanceof THREE.Vector3 ? e : new THREE.Vector3();
      f = f instanceof THREE.Quaternion ? f : new THREE.Quaternion();
      g = g instanceof THREE.Vector3 ? g : new THREE.Vector3();
      g.x = a.length();
      g.y = b.length();
      g.z = c.length();
      e.x = h[12];
      e.y = h[13];
      e.z = h[14];
      d.copy(this);
      d.elements[0] /= g.x;
      d.elements[1] /= g.x;
      d.elements[2] /= g.x;
      d.elements[4] /= g.y;
      d.elements[5] /= g.y;
      d.elements[6] /= g.y;
      d.elements[8] /= g.z;
      d.elements[9] /= g.z;
      d.elements[10] /= g.z;
      f.setFromRotationMatrix(d);
      return [e, f, g];
    };
  })(),
});
THREE.Ray = function (a, b) {
  this.origin = void 0 !== a ? a : new THREE.Vector3();
  this.direction = void 0 !== b ? b : new THREE.Vector3();
};
THREE.Ray.prototype = {
  constructor: THREE.Ray,
  set: function (a, b) {
    this.origin.copy(a);
    this.direction.copy(b);
    return this;
  },
  copy: function (a) {
    this.origin.copy(a.origin);
    this.direction.copy(a.direction);
    return this;
  },
  at: function (a, b) {
    return (b || new THREE.Vector3())
      .copy(this.direction)
      .multiplyScalar(a)
      .add(this.origin);
  },
  recast: (function () {
    var a = new THREE.Vector3();
    return function (b) {
      this.origin.copy(this.at(b, a));
      return this;
    };
  })(),
  closestPointToPoint: function (a, b) {
    var c = b || new THREE.Vector3();
    c.subVectors(a, this.origin);
    var d = c.dot(this.direction);
    return c.copy(this.direction).multiplyScalar(d).add(this.origin);
  },
  distanceToPoint: (function () {
    var a = new THREE.Vector3();
    return function (b) {
      var c = a.subVectors(b, this.origin).dot(this.direction);
      a.copy(this.direction).multiplyScalar(c).add(this.origin);
      return a.distanceTo(b);
    };
  })(),
  isIntersectionSphere: function (a) {
    return this.distanceToPoint(a.center) <= a.radius;
  },
  isIntersectionPlane: function (a) {
    return 0 != a.normal.dot(this.direction) ||
      0 == a.distanceToPoint(this.origin)
      ? !0
      : !1;
  },
  distanceToPlane: function (a) {
    var b = a.normal.dot(this.direction);
    if (0 == b) {
      if (0 == a.distanceToPoint(this.origin)) return 0;
    } else return -(this.origin.dot(a.normal) + a.constant) / b;
  },
  intersectPlane: function (a, b) {
    var c = this.distanceToPlane(a);
    return void 0 === c ? void 0 : this.at(c, b);
  },
  applyMatrix4: function (a) {
    this.direction.add(this.origin).applyMatrix4(a);
    this.origin.applyMatrix4(a);
    this.direction.sub(this.origin);
    return this;
  },
  equals: function (a) {
    return a.origin.equals(this.origin) && a.direction.equals(this.direction);
  },
  clone: function () {
    return new THREE.Ray().copy(this);
  },
};
THREE.Sphere = function (a, b) {
  this.center = void 0 !== a ? a : new THREE.Vector3();
  this.radius = void 0 !== b ? b : 0;
};
THREE.Sphere.prototype = {
  constructor: THREE.Sphere,
  set: function (a, b) {
    this.center.copy(a);
    this.radius = b;
    return this;
  },
  setFromCenterAndPoints: function (a, b) {
    for (var c = 0, d = 0, e = b.length; d < e; d++)
      var f = a.distanceToSquared(b[d]), c = Math.max(c, f);
    this.center = a;
    this.radius = Math.sqrt(c);
    return this;
  },
  copy: function (a) {
    this.center.copy(a.center);
    this.radius = a.radius;
    return this;
  },
  empty: function () {
    return 0 >= this.radius;
  },
  containsPoint: function (a) {
    return a.distanceToSquared(this.center) <= this.radius * this.radius;
  },
  distanceToPoint: function (a) {
    return a.distanceTo(this.center) - this.radius;
  },
  intersectsSphere: function (a) {
    var b = this.radius + a.radius;
    return a.center.distanceToSquared(this.center) <= b * b;
  },
  clampPoint: function (a, b) {
    var c = this.center.distanceToSquared(a),
      d = b || new THREE.Vector3();
    d.copy(a);
    c > this.radius * this.radius &&
      (d.sub(this.center).normalize(),
      d.multiplyScalar(this.radius).add(this.center));
    return d;
  },
  getBoundingBox: function (a) {
    a = a || new THREE.Box3();
    a.set(this.center, this.center);
    a.expandByScalar(this.radius);
    return a;
  },
  applyMatrix4: function (a) {
    this.center.applyMatrix4(a);
    this.radius *= a.getMaxScaleOnAxis();
    return this;
  },
  translate: function (a) {
    this.center.add(a);
    return this;
  },
  equals: function (a) {
    return a.center.equals(this.center) && a.radius === this.radius;
  },
  clone: function () {
    return new THREE.Sphere().copy(this);
  },
};
THREE.Frustum = function (a, b, c, d, e, f) {
  this.planes = [
    void 0 !== a ? a : new THREE.Plane(),
    void 0 !== b ? b : new THREE.Plane(),
    void 0 !== c ? c : new THREE.Plane(),
    void 0 !== d ? d : new THREE.Plane(),
    void 0 !== e ? e : new THREE.Plane(),
    void 0 !== f ? f : new THREE.Plane(),
  ];
};
THREE.Frustum.prototype = {
  constructor: THREE.Frustum,
  set: function (a, b, c, d, e, f) {
    var g = this.planes;
    g[0].copy(a);
    g[1].copy(b);
    g[2].copy(c);
    g[3].copy(d);
    g[4].copy(e);
    g[5].copy(f);
    return this;
  },
  copy: function (a) {
    for (var b = this.planes, c = 0; 6 > c; c++) b[c].copy(a.planes[c]);
    return this;
  },
  setFromMatrix: function (a) {
    var b = this.planes,
      c = a.elements,
      a = c[0],
      d = c[1],
      e = c[2],
      f = c[3],
      g = c[4],
      h = c[5],
      i = c[6],
      j = c[7],
      m = c[8],
      p = c[9],
      l = c[10],
      r = c[11],
      s = c[12],
      n = c[13],
      q = c[14],
      c = c[15];
    b[0].setComponents(f - a, j - g, r - m, c - s).normalize();
    b[1].setComponents(f + a, j + g, r + m, c + s).normalize();
    b[2].setComponents(f + d, j + h, r + p, c + n).normalize();
    b[3].setComponents(f - d, j - h, r - p, c - n).normalize();
    b[4].setComponents(f - e, j - i, r - l, c - q).normalize();
    b[5].setComponents(f + e, j + i, r + l, c + q).normalize();
    return this;
  },
  intersectsObject: (function () {
    var a = new THREE.Vector3();
    return function (b) {
      var c = b.matrixWorld,
        d = this.planes,
        b = -b.geometry.boundingSphere.radius * c.getMaxScaleOnAxis();
      a.getPositionFromMatrix(c);
      for (c = 0; 6 > c; c++) if (d[c].distanceToPoint(a) < b) return !1;
      return !0;
    };
  })(),
  intersectsSphere: function (a) {
    for (var b = this.planes, c = a.center, a = -a.radius, d = 0; 6 > d; d++)
      if (b[d].distanceToPoint(c) < a) return !1;
    return !0;
  },
  containsPoint: function (a) {
    for (var b = this.planes, c = 0; 6 > c; c++)
      if (0 > b[c].distanceToPoint(a)) return !1;
    return !0;
  },
  clone: function () {
    return new THREE.Frustum().copy(this);
  },
};
THREE.Plane = function (a, b) {
  this.normal = void 0 !== a ? a : new THREE.Vector3(1, 0, 0);
  this.constant = void 0 !== b ? b : 0;
};
THREE.Plane.prototype = {
  constructor: THREE.Plane,
  set: function (a, b) {
    this.normal.copy(a);
    this.constant = b;
    return this;
  },
  setComponents: function (a, b, c, d) {
    this.normal.set(a, b, c);
    this.constant = d;
    return this;
  },
  setFromNormalAndCoplanarPoint: function (a, b) {
    this.normal.copy(a);
    this.constant = -b.dot(this.normal);
    return this;
  },
  setFromCoplanarPoints: (function () {
    var a = new THREE.Vector3(),
      b = new THREE.Vector3();
    return function (c, d, e) {
      d = a.subVectors(e, d).cross(b.subVectors(c, d)).normalize();
      this.setFromNormalAndCoplanarPoint(d, c);
      return this;
    };
  })(),
  copy: function (a) {
    this.normal.copy(a.normal);
    this.constant = a.constant;
    return this;
  },
  normalize: function () {
    var a = 1 / this.normal.length();
    this.normal.multiplyScalar(a);
    this.constant *= a;
    return this;
  },
  negate: function () {
    this.constant *= -1;
    this.normal.negate();
    return this;
  },
  distanceToPoint: function (a) {
    return this.normal.dot(a) + this.constant;
  },
  distanceToSphere: function (a) {
    return this.distanceToPoint(a.center) - a.radius;
  },
  projectPoint: function (a, b) {
    return this.orthoPoint(a, b).sub(a).negate();
  },
  orthoPoint: function (a, b) {
    var c = this.distanceToPoint(a);
    return (b || new THREE.Vector3()).copy(this.normal).multiplyScalar(c);
  },
  isIntersectionLine: function (a) {
    var b = this.distanceToPoint(a.start),
      a = this.distanceToPoint(a.end);
    return (0 > b && 0 < a) || (0 > a && 0 < b);
  },
  intersectLine: (function () {
    var a = new THREE.Vector3();
    return function (b, c) {
      var d = c || new THREE.Vector3(),
        e = b.delta(a),
        f = this.normal.dot(e);
      if (0 == f) {
        if (0 == this.distanceToPoint(b.start)) return d.copy(b.start);
      } else
        return (
          (f = -(b.start.dot(this.normal) + this.constant) / f),
          0 > f || 1 < f ? void 0 : d.copy(e).multiplyScalar(f).add(b.start)
        );
    };
  })(),
  coplanarPoint: function (a) {
    return (a || new THREE.Vector3())
      .copy(this.normal)
      .multiplyScalar(-this.constant);
  },
  applyMatrix4: (function () {
    var a = new THREE.Vector3(),
      b = new THREE.Vector3();
    return function (c, d) {
      var d = d || new THREE.Matrix3().getNormalMatrix(c),
        e = a.copy(this.normal).applyMatrix3(d),
        f = this.coplanarPoint(b);
      f.applyMatrix4(c);
      this.setFromNormalAndCoplanarPoint(e, f);
      return this;
    };
  })(),
  translate: function (a) {
    this.constant -= a.dot(this.normal);
    return this;
  },
  equals: function (a) {
    return a.normal.equals(this.normal) && a.constant == this.constant;
  },
  clone: function () {
    return new THREE.Plane().copy(this);
  },
};
THREE.Math = {
  clamp: function (a, b, c) {
    return a < b ? b : a > c ? c : a;
  },
  clampBottom: function (a, b) {
    return a < b ? b : a;
  },
  mapLinear: function (a, b, c, d, e) {
    return d + ((a - b) * (e - d)) / (c - b);
  },
  smoothstep: function (a, b, c) {
    if (a <= b) return 0;
    if (a >= c) return 1;
    a = (a - b) / (c - b);
    return a * a * (3 - 2 * a);
  },
  smootherstep: function (a, b, c) {
    if (a <= b) return 0;
    if (a >= c) return 1;
    a = (a - b) / (c - b);
    return a * a * a * (a * (6 * a - 15) + 10);
  },
  random16: function () {
    return (65280 * Math.random() + 255 * Math.random()) / 65535;
  },
  randInt: function (a, b) {
    return a + Math.floor(Math.random() * (b - a + 1));
  },
  randFloat: function (a, b) {
    return a + Math.random() * (b - a);
  },
  randFloatSpread: function (a) {
    return a * (0.5 - Math.random());
  },
  sign: function (a) {
    return 0 > a ? -1 : 0 < a ? 1 : 0;
  },
  degToRad: (function () {
    var a = Math.PI / 180;
    return function (b) {
      return b * a;
    };
  })(),
  radToDeg: (function () {
    var a = 180 / Math.PI;
    return function (b) {
      return b * a;
    };
  })(),
};
THREE.Spline = function (a) {
  function b(a, b, c, d, e, f, g) {
    a = 0.5 * (c - a);
    d = 0.5 * (d - b);
    return (
      (2 * (b - c) + a + d) * g + (-3 * (b - c) - 2 * a - d) * f + a * e + b
    );
  }
  this.points = a;
  var c = [],
    d = { x: 0, y: 0, z: 0 },
    e,
    f,
    g,
    h,
    i,
    j,
    m,
    p,
    l;
  this.initFromArray = function (a) {
    this.points = [];
    for (var b = 0; b < a.length; b++)
      this.points[b] = { x: a[b][0], y: a[b][1], z: a[b][2] };
  };
  this.getPoint = function (a) {
    e = (this.points.length - 1) * a;
    f = Math.floor(e);
    g = e - f;
    c[0] = 0 === f ? f : f - 1;
    c[1] = f;
    c[2] = f > this.points.length - 2 ? this.points.length - 1 : f + 1;
    c[3] = f > this.points.length - 3 ? this.points.length - 1 : f + 2;
    j = this.points[c[0]];
    m = this.points[c[1]];
    p = this.points[c[2]];
    l = this.points[c[3]];
    h = g * g;
    i = g * h;
    d.x = b(j.x, m.x, p.x, l.x, g, h, i);
    d.y = b(j.y, m.y, p.y, l.y, g, h, i);
    d.z = b(j.z, m.z, p.z, l.z, g, h, i);
    return d;
  };
  this.getControlPointsArray = function () {
    var a,
      b,
      c = this.points.length,
      d = [];
    for (a = 0; a < c; a++) (b = this.points[a]), (d[a] = [b.x, b.y, b.z]);
    return d;
  };
  this.getLength = function (a) {
    var b,
      c,
      d,
      e = (b = b = 0),
      f = new THREE.Vector3(),
      g = new THREE.Vector3(),
      h = [],
      i = 0;
    h[0] = 0;
    a || (a = 100);
    c = this.points.length * a;
    f.copy(this.points[0]);
    for (a = 1; a < c; a++)
      (b = a / c),
        (d = this.getPoint(b)),
        g.copy(d),
        (i += g.distanceTo(f)),
        f.copy(d),
        (b *= this.points.length - 1),
        (b = Math.floor(b)),
        b != e && ((h[b] = i), (e = b));
    h[h.length] = i;
    return { chunks: h, total: i };
  };
  this.reparametrizeByArcLength = function (a) {
    var b,
      c,
      d,
      e,
      f,
      g,
      h = [],
      i = new THREE.Vector3(),
      j = this.getLength();
    h.push(i.copy(this.points[0]).clone());
    for (b = 1; b < this.points.length; b++) {
      c = j.chunks[b] - j.chunks[b - 1];
      g = Math.ceil((a * c) / j.total);
      e = (b - 1) / (this.points.length - 1);
      f = b / (this.points.length - 1);
      for (c = 1; c < g - 1; c++)
        (d = e + c * (1 / g) * (f - e)),
          (d = this.getPoint(d)),
          h.push(i.copy(d).clone());
      h.push(i.copy(this.points[b]).clone());
    }
    this.points = h;
  };
};
THREE.Triangle = function (a, b, c) {
  this.a = void 0 !== a ? a : new THREE.Vector3();
  this.b = void 0 !== b ? b : new THREE.Vector3();
  this.c = void 0 !== c ? c : new THREE.Vector3();
};
THREE.Triangle.normal = (function () {
  var a = new THREE.Vector3();
  return function (b, c, d, e) {
    e = e || new THREE.Vector3();
    e.subVectors(d, c);
    a.subVectors(b, c);
    e.cross(a);
    b = e.lengthSq();
    return 0 < b ? e.multiplyScalar(1 / Math.sqrt(b)) : e.set(0, 0, 0);
  };
})();
THREE.Triangle.barycoordFromPoint = (function () {
  var a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  return function (d, e, f, g, h) {
    a.subVectors(g, e);
    b.subVectors(f, e);
    c.subVectors(d, e);
    var d = a.dot(a),
      e = a.dot(b),
      f = a.dot(c),
      i = b.dot(b),
      g = b.dot(c),
      j = d * i - e * e,
      h = h || new THREE.Vector3();
    if (0 == j) return h.set(-2, -1, -1);
    j = 1 / j;
    i = (i * f - e * g) * j;
    d = (d * g - e * f) * j;
    return h.set(1 - i - d, d, i);
  };
})();
THREE.Triangle.containsPoint = (function () {
  var a = new THREE.Vector3();
  return function (b, c, d, e) {
    b = THREE.Triangle.barycoordFromPoint(b, c, d, e, a);
    return 0 <= b.x && 0 <= b.y && 1 >= b.x + b.y;
  };
})();
THREE.Triangle.prototype = {
  constructor: THREE.Triangle,
  set: function (a, b, c) {
    this.a.copy(a);
    this.b.copy(b);
    this.c.copy(c);
    return this;
  },
  setFromPointsAndIndices: function (a, b, c, d) {
    this.a.copy(a[b]);
    this.b.copy(a[c]);
    this.c.copy(a[d]);
    return this;
  },
  copy: function (a) {
    this.a.copy(a.a);
    this.b.copy(a.b);
    this.c.copy(a.c);
    return this;
  },
  area: (function () {
    var a = new THREE.Vector3(),
      b = new THREE.Vector3();
    return function () {
      a.subVectors(this.c, this.b);
      b.subVectors(this.a, this.b);
      return 0.5 * a.cross(b).length();
    };
  })(),
  midpoint: function (a) {
    return (a || new THREE.Vector3())
      .addVectors(this.a, this.b)
      .add(this.c)
      .multiplyScalar(1 / 3);
  },
  normal: function (a) {
    return THREE.Triangle.normal(this.a, this.b, this.c, a);
  },
  plane: function (a) {
    return (a || new THREE.Plane()).setFromCoplanarPoints(
      this.a,
      this.b,
      this.c
    );
  },
  barycoordFromPoint: function (a, b) {
    return THREE.Triangle.barycoordFromPoint(a, this.a, this.b, this.c, b);
  },
  containsPoint: function (a) {
    return THREE.Triangle.containsPoint(a, this.a, this.b, this.c);
  },
  equals: function (a) {
    return a.a.equals(this.a) && a.b.equals(this.b) && a.c.equals(this.c);
  },
  clone: function () {
    return new THREE.Triangle().copy(this);
  },
};
THREE.Vertex = function (a) {
  console.warn("THREE.Vertex has been DEPRECATED. Use THREE.Vector3 instead.");
  return a;
};
THREE.UV = function (a, b) {
  console.warn("THREE.UV has been DEPRECATED. Use THREE.Vector2 instead.");
  return new THREE.Vector2(a, b);
};
THREE.Clock = function (a) {
  this.autoStart = void 0 !== a ? a : !0;
  this.elapsedTime = this.oldTime = this.startTime = 0;
  this.running = !1;
};
THREE.Clock.prototype = {
  constructor: THREE.Clock,
  start: function () {
    this.oldTime = this.startTime =
      void 0 !== window.performance && void 0 !== window.performance.now
        ? window.performance.now()
        : Date.now();
    this.running = !0;
  },
  stop: function () {
    this.getElapsedTime();
    this.running = !1;
  },
  getElapsedTime: function () {
    this.getDelta();
    return this.elapsedTime;
  },
  getDelta: function () {
    var a = 0;
    this.autoStart && !this.running && this.start();
    if (this.running) {
      var b =
          void 0 !== window.performance && void 0 !== window.performance.now
            ? window.performance.now()
            : Date.now(),
        a = 0.001 * (b - this.oldTime);
      this.oldTime = b;
      this.elapsedTime += a;
    }
    return a;
  },
};
THREE.EventDispatcher = function () {};
THREE.EventDispatcher.prototype = {
  constructor: THREE.EventDispatcher,
  addEventListener: function (a, b) {
    void 0 === this._listeners && (this._listeners = {});
    var c = this._listeners;
    void 0 === c[a] && (c[a] = []);
    -1 === c[a].indexOf(b) && c[a].push(b);
  },
  hasEventListener: function (a, b) {
    if (void 0 === this._listeners) return !1;
    var c = this._listeners;
    return void 0 !== c[a] && -1 !== c[a].indexOf(b) ? !0 : !1;
  },
  removeEventListener: function (a, b) {
    if (void 0 !== this._listeners) {
      var c = this._listeners,
        d = c[a].indexOf(b);
      -1 !== d && c[a].splice(d, 1);
    }
  },
  dispatchEvent: function (a) {
    if (void 0 !== this._listeners) {
      var b = this._listeners[a.type];
      if (void 0 !== b) {
        a.target = this;
        for (var c = 0, d = b.length; c < d; c++) b[c].call(this, a);
      }
    }
  },
};
(function (a) {
  a.Raycaster = function (b, c, d, e) {
    this.ray = new a.Ray(b, c);
    0 < this.ray.direction.lengthSq() && this.ray.direction.normalize();
    this.near = d || 0;
    this.far = e || Infinity;
  };
  var b = new a.Sphere(),
    c = new a.Ray(),
    d = new a.Plane(),
    e = new a.Vector3(),
    f = new a.Vector3(),
    g = new a.Matrix4(),
    h = function (a, b) {
      return a.distance - b.distance;
    },
    i = function (h, j, l) {
      if (h instanceof a.Particle) {
        f.getPositionFromMatrix(h.matrixWorld);
        var r = j.ray.distanceToPoint(f);
        if (r > h.scale.x) return l;
        l.push({ distance: r, point: h.position, face: null, object: h });
      } else if (h instanceof a.LOD)
        f.getPositionFromMatrix(h.matrixWorld),
          (r = j.ray.origin.distanceTo(f)),
          i(h.getObjectForDistance(r), j, l);
      else if (h instanceof a.Mesh) {
        f.getPositionFromMatrix(h.matrixWorld);
        b.set(
          f,
          h.geometry.boundingSphere.radius * h.matrixWorld.getMaxScaleOnAxis()
        );
        if (!j.ray.isIntersectionSphere(b)) return l;
        var r = h.geometry,
          s = r.vertices,
          n = h.material instanceof a.MeshFaceMaterial,
          q = !0 === n ? h.material.materials : null,
          y = h.material.side,
          u,
          x,
          t,
          E = j.precision;
        g.getInverse(h.matrixWorld);
        c.copy(j.ray).applyMatrix4(g);
        for (var J = 0, F = r.faces.length; J < F; J++) {
          var z = r.faces[J],
            y = !0 === n ? q[z.materialIndex] : h.material;
          if (void 0 !== y) {
            d.setFromNormalAndCoplanarPoint(z.normal, s[z.a]);
            var H = c.distanceToPlane(d);
            if (!(Math.abs(H) < E) && !(0 > H)) {
              y = y.side;
              if (
                y !== a.DoubleSide &&
                ((u = c.direction.dot(d.normal)),
                !(y === a.FrontSide ? 0 > u : 0 < u))
              )
                continue;
              if (!(H < j.near || H > j.far)) {
                e = c.at(H, e);
                if (z instanceof a.Face3) {
                  if (
                    ((y = s[z.a]),
                    (u = s[z.b]),
                    (x = s[z.c]),
                    !a.Triangle.containsPoint(e, y, u, x))
                  )
                    continue;
                } else if (z instanceof a.Face4) {
                  if (
                    ((y = s[z.a]),
                    (u = s[z.b]),
                    (x = s[z.c]),
                    (t = s[z.d]),
                    !a.Triangle.containsPoint(e, y, u, t) &&
                      !a.Triangle.containsPoint(e, u, x, t))
                  )
                    continue;
                } else throw Error("face type not supported");
                l.push({
                  distance: H,
                  point: j.ray.at(H),
                  face: z,
                  faceIndex: J,
                  object: h,
                });
              }
            }
          }
        }
      }
    },
    j = function (a, b, c) {
      for (var a = a.getDescendants(), d = 0, e = a.length; d < e; d++)
        i(a[d], b, c);
    };
  a.Raycaster.prototype.precision = 1e-4;
  a.Raycaster.prototype.set = function (a, b) {
    this.ray.set(a, b);
    0 < this.ray.direction.length() && this.ray.direction.normalize();
  };
  a.Raycaster.prototype.intersectObject = function (a, b) {
    var c = [];
    !0 === b && j(a, this, c);
    i(a, this, c);
    c.sort(h);
    return c;
  };
  a.Raycaster.prototype.intersectObjects = function (a, b) {
    for (var c = [], d = 0, e = a.length; d < e; d++)
      i(a[d], this, c), !0 === b && j(a[d], this, c);
    c.sort(h);
    return c;
  };
})(THREE);
THREE.Object3D = function () {
  this.id = THREE.Object3DIdCount++;
  this.name = "";
  this.parent = void 0;
  this.children = [];
  this.up = new THREE.Vector3(0, 1, 0);
  this.position = new THREE.Vector3();
  this.rotation = new THREE.Vector3();
  this.eulerOrder = THREE.Object3D.defaultEulerOrder;
  this.scale = new THREE.Vector3(1, 1, 1);
  this.renderDepth = null;
  this.rotationAutoUpdate = !0;
  this.matrix = new THREE.Matrix4();
  this.matrixWorld = new THREE.Matrix4();
  this.matrixWorldNeedsUpdate = this.matrixAutoUpdate = !0;
  this.quaternion = new THREE.Quaternion();
  this.useQuaternion = !1;
  this.visible = !0;
  this.receiveShadow = this.castShadow = !1;
  this.frustumCulled = !0;
  this.userData = {};
};
THREE.Object3D.prototype = {
  constructor: THREE.Object3D,
  applyMatrix: (function () {
    var a = new THREE.Matrix4();
    return function (b) {
      this.matrix.multiplyMatrices(b, this.matrix);
      this.position.getPositionFromMatrix(this.matrix);
      this.scale.getScaleFromMatrix(this.matrix);
      a.extractRotation(this.matrix);
      !0 === this.useQuaternion
        ? this.quaternion.setFromRotationMatrix(a)
        : this.rotation.setEulerFromRotationMatrix(a, this.eulerOrder);
    };
  })(),
  rotateOnAxis: (function () {
    var a = new THREE.Quaternion(),
      b = new THREE.Quaternion();
    return function (c, d) {
      a.setFromAxisAngle(c, d);
      !0 === this.useQuaternion
        ? this.quaternion.multiply(a)
        : (b.setFromEuler(this.rotation, this.eulerOrder),
          b.multiply(a),
          this.rotation.setEulerFromQuaternion(b, this.eulerOrder));
      return this;
    };
  })(),
  translateOnAxis: (function () {
    var a = new THREE.Vector3();
    return function (b, c) {
      a.copy(b);
      !0 === this.useQuaternion
        ? a.applyQuaternion(this.quaternion)
        : a.applyEuler(this.rotation, this.eulerOrder);
      this.position.add(a.multiplyScalar(c));
      return this;
    };
  })(),
  translate: function (a, b) {
    console.warn(
      "DEPRECATED: Object3D's .translate() has been removed. Use .translateOnAxis( axis, distance ) instead. Note args have been changed."
    );
    return this.translateOnAxis(b, a);
  },
  translateX: (function () {
    var a = new THREE.Vector3(1, 0, 0);
    return function (b) {
      return this.translateOnAxis(a, b);
    };
  })(),
  translateY: (function () {
    var a = new THREE.Vector3(0, 1, 0);
    return function (b) {
      return this.translateOnAxis(a, b);
    };
  })(),
  translateZ: (function () {
    var a = new THREE.Vector3(0, 0, 1);
    return function (b) {
      return this.translateOnAxis(a, b);
    };
  })(),
  localToWorld: function (a) {
    return a.applyMatrix4(this.matrixWorld);
  },
  worldToLocal: (function () {
    var a = new THREE.Matrix4();
    return function (b) {
      return b.applyMatrix4(a.getInverse(this.matrixWorld));
    };
  })(),
  lookAt: (function () {
    var a = new THREE.Matrix4();
    return function (b) {
      a.lookAt(b, this.position, this.up);
      !0 === this.useQuaternion
        ? this.quaternion.setFromRotationMatrix(a)
        : this.rotation.setEulerFromRotationMatrix(a, this.eulerOrder);
    };
  })(),
  add: function (a) {
    if (a === this)
      console.warn(
        "THREE.Object3D.add: An object can't be added as a child of itself."
      );
    else if (a instanceof THREE.Object3D) {
      void 0 !== a.parent && a.parent.remove(a);
      a.parent = this;
      this.children.push(a);
      for (var b = this; void 0 !== b.parent; ) b = b.parent;
      void 0 !== b && b instanceof THREE.Scene && b.__addObject(a);
    }
  },
  remove: function (a) {
    var b = this.children.indexOf(a);
    if (-1 !== b) {
      a.parent = void 0;
      this.children.splice(b, 1);
      for (b = this; void 0 !== b.parent; ) b = b.parent;
      void 0 !== b && b instanceof THREE.Scene && b.__removeObject(a);
    }
  },
  traverse: function (a) {
    a(this);
    for (var b = 0, c = this.children.length; b < c; b++)
      this.children[b].traverse(a);
  },
  getObjectById: function (a, b) {
    for (var c = 0, d = this.children.length; c < d; c++) {
      var e = this.children[c];
      if (
        e.id === a ||
        (!0 === b && ((e = e.getObjectById(a, b)), void 0 !== e))
      )
        return e;
    }
  },
  getObjectByName: function (a, b) {
    for (var c = 0, d = this.children.length; c < d; c++) {
      var e = this.children[c];
      if (
        e.name === a ||
        (!0 === b && ((e = e.getObjectByName(a, b)), void 0 !== e))
      )
        return e;
    }
  },
  getChildByName: function (a, b) {
    console.warn(
      "DEPRECATED: Object3D's .getChildByName() has been renamed to .getObjectByName()."
    );
    return this.getObjectByName(a, b);
  },
  getDescendants: function (a) {
    void 0 === a && (a = []);
    Array.prototype.push.apply(a, this.children);
    for (var b = 0, c = this.children.length; b < c; b++)
      this.children[b].getDescendants(a);
    return a;
  },
  updateMatrix: function () {
    !1 === this.useQuaternion
      ? this.matrix.makeFromPositionEulerScale(
          this.position,
          this.rotation,
          this.eulerOrder,
          this.scale
        )
      : this.matrix.makeFromPositionQuaternionScale(
          this.position,
          this.quaternion,
          this.scale
        );
    this.matrixWorldNeedsUpdate = !0;
  },
  updateMatrixWorld: function (a) {
    !0 === this.matrixAutoUpdate && this.updateMatrix();
    if (!0 === this.matrixWorldNeedsUpdate || !0 === a)
      void 0 === this.parent
        ? this.matrixWorld.copy(this.matrix)
        : this.matrixWorld.multiplyMatrices(
            this.parent.matrixWorld,
            this.matrix
          ),
        (this.matrixWorldNeedsUpdate = !1),
        (a = !0);
    for (var b = 0, c = this.children.length; b < c; b++)
      this.children[b].updateMatrixWorld(a);
  },
  clone: function (a) {
    void 0 === a && (a = new THREE.Object3D());
    a.name = this.name;
    a.up.copy(this.up);
    a.position.copy(this.position);
    a.rotation instanceof THREE.Vector3 && a.rotation.copy(this.rotation);
    a.eulerOrder = this.eulerOrder;
    a.scale.copy(this.scale);
    a.renderDepth = this.renderDepth;
    a.rotationAutoUpdate = this.rotationAutoUpdate;
    a.matrix.copy(this.matrix);
    a.matrixWorld.copy(this.matrixWorld);
    a.matrixAutoUpdate = this.matrixAutoUpdate;
    a.matrixWorldNeedsUpdate = this.matrixWorldNeedsUpdate;
    a.quaternion.copy(this.quaternion);
    a.useQuaternion = this.useQuaternion;
    a.visible = this.visible;
    a.castShadow = this.castShadow;
    a.receiveShadow = this.receiveShadow;
    a.frustumCulled = this.frustumCulled;
    a.userData = JSON.parse(JSON.stringify(this.userData));
    for (var b = 0; b < this.children.length; b++)
      a.add(this.children[b].clone());
    return a;
  },
};
THREE.Object3D.defaultEulerOrder = "XYZ";
THREE.Object3DIdCount = 0;
THREE.Projector = function () {
  function a() {
    if (f === h) {
      var a = new THREE.RenderableObject();
      g.push(a);
      h++;
      f++;
      return a;
    }
    return g[f++];
  }
  function b() {
    if (j === p) {
      var a = new THREE.RenderableVertex();
      m.push(a);
      p++;
      j++;
      return a;
    }
    return m[j++];
  }
  function c(a, b) {
    return b.z - a.z;
  }
  function d(a, b) {
    var c = 0,
      d = 1,
      e = a.z + a.w,
      f = b.z + b.w,
      g = -a.z + a.w,
      h = -b.z + b.w;
    if (0 <= e && 0 <= f && 0 <= g && 0 <= h) return !0;
    if ((0 > e && 0 > f) || (0 > g && 0 > h)) return !1;
    0 > e
      ? (c = Math.max(c, e / (e - f)))
      : 0 > f && (d = Math.min(d, e / (e - f)));
    0 > g
      ? (c = Math.max(c, g / (g - h)))
      : 0 > h && (d = Math.min(d, g / (g - h)));
    if (d < c) return !1;
    a.lerp(b, c);
    b.lerp(a, 1 - d);
    return !0;
  }
  var e,
    f,
    g = [],
    h = 0,
    i,
    j,
    m = [],
    p = 0,
    l,
    r,
    s = [],
    n = 0,
    q,
    y = [],
    u = 0,
    x,
    t,
    E = [],
    J = 0,
    F,
    z,
    H = [],
    K = 0,
    G = { objects: [], sprites: [], lights: [], elements: [] },
    L = new THREE.Vector3(),
    B = new THREE.Vector4(),
    V = new THREE.Box3(
      new THREE.Vector3(-1, -1, -1),
      new THREE.Vector3(1, 1, 1)
    ),
    C = new THREE.Box3(),
    I = Array(3),
    M = Array(4),
    R = new THREE.Matrix4(),
    ea = new THREE.Matrix4(),
    wa,
    Ma = new THREE.Matrix4(),
    A = new THREE.Matrix3(),
    ca = new THREE.Matrix3(),
    ja = new THREE.Vector3(),
    na = new THREE.Frustum(),
    N = new THREE.Vector4(),
    fa = new THREE.Vector4();
  this.projectVector = function (a, b) {
    b.matrixWorldInverse.getInverse(b.matrixWorld);
    ea.multiplyMatrices(b.projectionMatrix, b.matrixWorldInverse);
    return a.applyProjection(ea);
  };
  this.unprojectVector = function (a, b) {
    b.projectionMatrixInverse.getInverse(b.projectionMatrix);
    ea.multiplyMatrices(b.matrixWorld, b.projectionMatrixInverse);
    return a.applyProjection(ea);
  };
  this.pickingRay = function (a, b) {
    a.z = -1;
    var c = new THREE.Vector3(a.x, a.y, 1);
    this.unprojectVector(a, b);
    this.unprojectVector(c, b);
    c.sub(a).normalize();
    return new THREE.Raycaster(a, c);
  };
  this.projectScene = function (g, h, p, Ka) {
    var qa = !1,
      pa,
      Z,
      ga,
      W,
      da,
      la,
      ha,
      ia,
      Qa,
      kb,
      oa,
      Xa,
      Ra;
    z = t = q = r = 0;
    G.elements.length = 0;
    !0 === g.autoUpdate && g.updateMatrixWorld();
    void 0 === h.parent && h.updateMatrixWorld();
    R.copy(h.matrixWorldInverse.getInverse(h.matrixWorld));
    ea.multiplyMatrices(h.projectionMatrix, R);
    ca.getNormalMatrix(R);
    na.setFromMatrix(ea);
    f = 0;
    G.objects.length = 0;
    G.sprites.length = 0;
    G.lights.length = 0;
    var Aa = function (b) {
      for (var c = 0, d = b.children.length; c < d; c++) {
        var f = b.children[c];
        if (!1 !== f.visible) {
          if (f instanceof THREE.Light) G.lights.push(f);
          else if (f instanceof THREE.Mesh || f instanceof THREE.Line) {
            if (!1 === f.frustumCulled || !0 === na.intersectsObject(f))
              (e = a()),
                (e.object = f),
                null !== f.renderDepth
                  ? (e.z = f.renderDepth)
                  : (L.getPositionFromMatrix(f.matrixWorld),
                    L.applyProjection(ea),
                    (e.z = L.z)),
                G.objects.push(e);
          } else
            f instanceof THREE.Sprite || f instanceof THREE.Particle
              ? ((e = a()),
                (e.object = f),
                null !== f.renderDepth
                  ? (e.z = f.renderDepth)
                  : (L.getPositionFromMatrix(f.matrixWorld),
                    L.applyProjection(ea),
                    (e.z = L.z)),
                G.sprites.push(e))
              : ((e = a()),
                (e.object = f),
                null !== f.renderDepth
                  ? (e.z = f.renderDepth)
                  : (L.getPositionFromMatrix(f.matrixWorld),
                    L.applyProjection(ea),
                    (e.z = L.z)),
                G.objects.push(e));
          Aa(f);
        }
      }
    };
    Aa(g);
    !0 === p && G.objects.sort(c);
    g = 0;
    for (p = G.objects.length; g < p; g++)
      if (
        ((ia = G.objects[g].object),
        (wa = ia.matrixWorld),
        (j = 0),
        ia instanceof THREE.Mesh)
      ) {
        Qa = ia.geometry;
        ga = Qa.vertices;
        kb = Qa.faces;
        Qa = Qa.faceVertexUvs;
        A.getNormalMatrix(wa);
        Xa = ia.material instanceof THREE.MeshFaceMaterial;
        Ra = !0 === Xa ? ia.material : null;
        pa = 0;
        for (Z = ga.length; pa < Z; pa++)
          (i = b()),
            i.positionWorld.copy(ga[pa]).applyMatrix4(wa),
            i.positionScreen.copy(i.positionWorld).applyMatrix4(ea),
            (i.positionScreen.x /= i.positionScreen.w),
            (i.positionScreen.y /= i.positionScreen.w),
            (i.positionScreen.z /= i.positionScreen.w),
            (i.visible = !(
              -1 > i.positionScreen.x ||
              1 < i.positionScreen.x ||
              -1 > i.positionScreen.y ||
              1 < i.positionScreen.y ||
              -1 > i.positionScreen.z ||
              1 < i.positionScreen.z
            ));
        ga = 0;
        for (pa = kb.length; ga < pa; ga++) {
          Z = kb[ga];
          var Sa = !0 === Xa ? Ra.materials[Z.materialIndex] : ia.material;
          if (void 0 !== Sa) {
            la = Sa.side;
            if (Z instanceof THREE.Face3)
              if (
                ((W = m[Z.a]),
                (da = m[Z.b]),
                (ha = m[Z.c]),
                (I[0] = W.positionScreen),
                (I[1] = da.positionScreen),
                (I[2] = ha.positionScreen),
                !0 === W.visible ||
                  !0 === da.visible ||
                  !0 === ha.visible ||
                  V.isIntersectionBox(C.setFromPoints(I)))
              )
                if (
                  ((qa =
                    0 >
                    (ha.positionScreen.x - W.positionScreen.x) *
                      (da.positionScreen.y - W.positionScreen.y) -
                      (ha.positionScreen.y - W.positionScreen.y) *
                        (da.positionScreen.x - W.positionScreen.x)),
                  la === THREE.DoubleSide || qa === (la === THREE.FrontSide))
                )
                  r === n
                    ? ((oa = new THREE.RenderableFace3()),
                      s.push(oa),
                      n++,
                      r++,
                      (l = oa))
                    : (l = s[r++]),
                    l.v1.copy(W),
                    l.v2.copy(da),
                    l.v3.copy(ha);
                else continue;
              else continue;
            else if (Z instanceof THREE.Face4)
              if (
                ((W = m[Z.a]),
                (da = m[Z.b]),
                (ha = m[Z.c]),
                (oa = m[Z.d]),
                (M[0] = W.positionScreen),
                (M[1] = da.positionScreen),
                (M[2] = ha.positionScreen),
                (M[3] = oa.positionScreen),
                !0 === W.visible ||
                  !0 === da.visible ||
                  !0 === ha.visible ||
                  !0 === oa.visible ||
                  V.isIntersectionBox(C.setFromPoints(M)))
              )
                if (
                  ((qa =
                    0 >
                      (oa.positionScreen.x - W.positionScreen.x) *
                        (da.positionScreen.y - W.positionScreen.y) -
                        (oa.positionScreen.y - W.positionScreen.y) *
                          (da.positionScreen.x - W.positionScreen.x) ||
                    0 >
                      (da.positionScreen.x - ha.positionScreen.x) *
                        (oa.positionScreen.y - ha.positionScreen.y) -
                        (da.positionScreen.y - ha.positionScreen.y) *
                          (oa.positionScreen.x - ha.positionScreen.x)),
                  la === THREE.DoubleSide || qa === (la === THREE.FrontSide))
                ) {
                  if (q === u) {
                    var sb = new THREE.RenderableFace4();
                    y.push(sb);
                    u++;
                    q++;
                    l = sb;
                  } else l = y[q++];
                  l.v1.copy(W);
                  l.v2.copy(da);
                  l.v3.copy(ha);
                  l.v4.copy(oa);
                } else continue;
              else continue;
            l.normalModel.copy(Z.normal);
            !1 === qa &&
              (la === THREE.BackSide || la === THREE.DoubleSide) &&
              l.normalModel.negate();
            l.normalModel.applyMatrix3(A).normalize();
            l.normalModelView.copy(l.normalModel).applyMatrix3(ca);
            l.centroidModel.copy(Z.centroid).applyMatrix4(wa);
            ha = Z.vertexNormals;
            W = 0;
            for (da = ha.length; W < da; W++)
              (oa = l.vertexNormalsModel[W]),
                oa.copy(ha[W]),
                !1 === qa &&
                  (la === THREE.BackSide || la === THREE.DoubleSide) &&
                  oa.negate(),
                oa.applyMatrix3(A).normalize(),
                l.vertexNormalsModelView[W].copy(oa).applyMatrix3(ca);
            l.vertexNormalsLength = ha.length;
            W = 0;
            for (da = Qa.length; W < da; W++)
              if (((oa = Qa[W][ga]), void 0 !== oa)) {
                la = 0;
                for (ha = oa.length; la < ha; la++) l.uvs[W][la] = oa[la];
              }
            l.color = Z.color;
            l.material = Sa;
            ja.copy(l.centroidModel).applyProjection(ea);
            l.z = ja.z;
            G.elements.push(l);
          }
        }
      } else if (ia instanceof THREE.Line) {
        Ma.multiplyMatrices(ea, wa);
        ga = ia.geometry.vertices;
        W = b();
        W.positionScreen.copy(ga[0]).applyMatrix4(Ma);
        kb = ia.type === THREE.LinePieces ? 2 : 1;
        pa = 1;
        for (Z = ga.length; pa < Z; pa++)
          (W = b()),
            W.positionScreen.copy(ga[pa]).applyMatrix4(Ma),
            0 < (pa + 1) % kb ||
              ((da = m[j - 2]),
              N.copy(W.positionScreen),
              fa.copy(da.positionScreen),
              !0 === d(N, fa) &&
                (N.multiplyScalar(1 / N.w),
                fa.multiplyScalar(1 / fa.w),
                t === J
                  ? ((Qa = new THREE.RenderableLine()),
                    E.push(Qa),
                    J++,
                    t++,
                    (x = Qa))
                  : (x = E[t++]),
                x.v1.positionScreen.copy(N),
                x.v2.positionScreen.copy(fa),
                (x.z = Math.max(N.z, fa.z)),
                (x.material = ia.material),
                ia.material.vertexColors === THREE.VertexColors &&
                  (x.vertexColors[0].copy(ia.geometry.colors[pa]),
                  x.vertexColors[1].copy(ia.geometry.colors[pa - 1])),
                G.elements.push(x)));
      }
    g = 0;
    for (p = G.sprites.length; g < p; g++)
      (ia = G.sprites[g].object),
        (wa = ia.matrixWorld),
        ia instanceof THREE.Particle &&
          (B.set(wa.elements[12], wa.elements[13], wa.elements[14], 1),
          B.applyMatrix4(ea),
          (B.z /= B.w),
          0 < B.z &&
            1 > B.z &&
            (z === K
              ? ((qa = new THREE.RenderableParticle()),
                H.push(qa),
                K++,
                z++,
                (F = qa))
              : (F = H[z++]),
            (F.object = ia),
            (F.x = B.x / B.w),
            (F.y = B.y / B.w),
            (F.z = B.z),
            (F.rotation = ia.rotation.z),
            (F.scale.x =
              ia.scale.x *
              Math.abs(
                F.x -
                  (B.x + h.projectionMatrix.elements[0]) /
                    (B.w + h.projectionMatrix.elements[12])
              )),
            (F.scale.y =
              ia.scale.y *
              Math.abs(
                F.y -
                  (B.y + h.projectionMatrix.elements[5]) /
                    (B.w + h.projectionMatrix.elements[13])
              )),
            (F.material = ia.material),
            G.elements.push(F)));
    !0 === Ka && G.elements.sort(c);
    return G;
  };
};
THREE.Face3 = function (a, b, c, d, e, f) {
  this.a = a;
  this.b = b;
  this.c = c;
  this.normal = d instanceof THREE.Vector3 ? d : new THREE.Vector3();
  this.vertexNormals = d instanceof Array ? d : [];
  this.color = e instanceof THREE.Color ? e : new THREE.Color();
  this.vertexColors = e instanceof Array ? e : [];
  this.vertexTangents = [];
  this.materialIndex = void 0 !== f ? f : 0;
  this.centroid = new THREE.Vector3();
};
THREE.Face3.prototype = {
  constructor: THREE.Face3,
  clone: function () {
    var a = new THREE.Face3(this.a, this.b, this.c);
    a.normal.copy(this.normal);
    a.color.copy(this.color);
    a.centroid.copy(this.centroid);
    a.materialIndex = this.materialIndex;
    var b, c;
    b = 0;
    for (c = this.vertexNormals.length; b < c; b++)
      a.vertexNormals[b] = this.vertexNormals[b].clone();
    b = 0;
    for (c = this.vertexColors.length; b < c; b++)
      a.vertexColors[b] = this.vertexColors[b].clone();
    b = 0;
    for (c = this.vertexTangents.length; b < c; b++)
      a.vertexTangents[b] = this.vertexTangents[b].clone();
    return a;
  },
};
THREE.Face4 = function (a, b, c, d, e, f, g) {
  this.a = a;
  this.b = b;
  this.c = c;
  this.d = d;
  this.normal = e instanceof THREE.Vector3 ? e : new THREE.Vector3();
  this.vertexNormals = e instanceof Array ? e : [];
  this.color = f instanceof THREE.Color ? f : new THREE.Color();
  this.vertexColors = f instanceof Array ? f : [];
  this.vertexTangents = [];
  this.materialIndex = void 0 !== g ? g : 0;
  this.centroid = new THREE.Vector3();
};
THREE.Face4.prototype = {
  constructor: THREE.Face4,
  clone: function () {
    var a = new THREE.Face4(this.a, this.b, this.c, this.d);
    a.normal.copy(this.normal);
    a.color.copy(this.color);
    a.centroid.copy(this.centroid);
    a.materialIndex = this.materialIndex;
    var b, c;
    b = 0;
    for (c = this.vertexNormals.length; b < c; b++)
      a.vertexNormals[b] = this.vertexNormals[b].clone();
    b = 0;
    for (c = this.vertexColors.length; b < c; b++)
      a.vertexColors[b] = this.vertexColors[b].clone();
    b = 0;
    for (c = this.vertexTangents.length; b < c; b++)
      a.vertexTangents[b] = this.vertexTangents[b].clone();
    return a;
  },
};
THREE.Geometry = function () {
  this.id = THREE.GeometryIdCount++;
  this.name = "";
  this.vertices = [];
  this.colors = [];
  this.normals = [];
  this.faces = [];
  this.faceUvs = [[]];
  this.faceVertexUvs = [[]];
  this.morphTargets = [];
  this.morphColors = [];
  this.morphNormals = [];
  this.skinWeights = [];
  this.skinIndices = [];
  this.lineDistances = [];
  this.boundingSphere = this.boundingBox = null;
  this.hasTangents = !1;
  this.dynamic = !0;
  this.buffersNeedUpdate =
    this.lineDistancesNeedUpdate =
    this.colorsNeedUpdate =
    this.tangentsNeedUpdate =
    this.normalsNeedUpdate =
    this.uvsNeedUpdate =
    this.elementsNeedUpdate =
    this.verticesNeedUpdate =
      !1;
};
THREE.Geometry.prototype = {
  constructor: THREE.Geometry,
  addEventListener: THREE.EventDispatcher.prototype.addEventListener,
  hasEventListener: THREE.EventDispatcher.prototype.hasEventListener,
  removeEventListener: THREE.EventDispatcher.prototype.removeEventListener,
  dispatchEvent: THREE.EventDispatcher.prototype.dispatchEvent,
  applyMatrix: function (a) {
    for (
      var b = new THREE.Matrix3().getNormalMatrix(a),
        c = 0,
        d = this.vertices.length;
      c < d;
      c++
    )
      this.vertices[c].applyMatrix4(a);
    c = 0;
    for (d = this.faces.length; c < d; c++) {
      var e = this.faces[c];
      e.normal.applyMatrix3(b).normalize();
      for (var f = 0, g = e.vertexNormals.length; f < g; f++)
        e.vertexNormals[f].applyMatrix3(b).normalize();
      e.centroid.applyMatrix4(a);
    }
  },
  computeCentroids: function () {
    var a, b, c;
    a = 0;
    for (b = this.faces.length; a < b; a++)
      (c = this.faces[a]),
        c.centroid.set(0, 0, 0),
        c instanceof THREE.Face3
          ? (c.centroid.add(this.vertices[c.a]),
            c.centroid.add(this.vertices[c.b]),
            c.centroid.add(this.vertices[c.c]),
            c.centroid.divideScalar(3))
          : c instanceof THREE.Face4 &&
            (c.centroid.add(this.vertices[c.a]),
            c.centroid.add(this.vertices[c.b]),
            c.centroid.add(this.vertices[c.c]),
            c.centroid.add(this.vertices[c.d]),
            c.centroid.divideScalar(4));
  },
  computeFaceNormals: function () {
    for (
      var a = new THREE.Vector3(),
        b = new THREE.Vector3(),
        c = 0,
        d = this.faces.length;
      c < d;
      c++
    ) {
      var e = this.faces[c],
        f = this.vertices[e.a],
        g = this.vertices[e.b];
      a.subVectors(this.vertices[e.c], g);
      b.subVectors(f, g);
      a.cross(b);
      a.normalize();
      e.normal.copy(a);
    }
  },
  computeVertexNormals: function (a) {
    var b, c, d, e;
    if (void 0 === this.__tmpVertices) {
      e = this.__tmpVertices = Array(this.vertices.length);
      b = 0;
      for (c = this.vertices.length; b < c; b++) e[b] = new THREE.Vector3();
      b = 0;
      for (c = this.faces.length; b < c; b++)
        (d = this.faces[b]),
          d instanceof THREE.Face3
            ? (d.vertexNormals = [
                new THREE.Vector3(),
                new THREE.Vector3(),
                new THREE.Vector3(),
              ])
            : d instanceof THREE.Face4 &&
              (d.vertexNormals = [
                new THREE.Vector3(),
                new THREE.Vector3(),
                new THREE.Vector3(),
                new THREE.Vector3(),
              ]);
    } else {
      e = this.__tmpVertices;
      b = 0;
      for (c = this.vertices.length; b < c; b++) e[b].set(0, 0, 0);
    }
    if (a) {
      var f,
        g,
        h,
        i = new THREE.Vector3(),
        j = new THREE.Vector3(),
        m = new THREE.Vector3(),
        p = new THREE.Vector3(),
        l = new THREE.Vector3();
      b = 0;
      for (c = this.faces.length; b < c; b++)
        (d = this.faces[b]),
          d instanceof THREE.Face3
            ? ((a = this.vertices[d.a]),
              (f = this.vertices[d.b]),
              (g = this.vertices[d.c]),
              i.subVectors(g, f),
              j.subVectors(a, f),
              i.cross(j),
              e[d.a].add(i),
              e[d.b].add(i),
              e[d.c].add(i))
            : d instanceof THREE.Face4 &&
              ((a = this.vertices[d.a]),
              (f = this.vertices[d.b]),
              (g = this.vertices[d.c]),
              (h = this.vertices[d.d]),
              m.subVectors(h, f),
              j.subVectors(a, f),
              m.cross(j),
              e[d.a].add(m),
              e[d.b].add(m),
              e[d.d].add(m),
              p.subVectors(h, g),
              l.subVectors(f, g),
              p.cross(l),
              e[d.b].add(p),
              e[d.c].add(p),
              e[d.d].add(p));
    } else {
      b = 0;
      for (c = this.faces.length; b < c; b++)
        (d = this.faces[b]),
          d instanceof THREE.Face3
            ? (e[d.a].add(d.normal), e[d.b].add(d.normal), e[d.c].add(d.normal))
            : d instanceof THREE.Face4 &&
              (e[d.a].add(d.normal),
              e[d.b].add(d.normal),
              e[d.c].add(d.normal),
              e[d.d].add(d.normal));
    }
    b = 0;
    for (c = this.vertices.length; b < c; b++) e[b].normalize();
    b = 0;
    for (c = this.faces.length; b < c; b++)
      (d = this.faces[b]),
        d instanceof THREE.Face3
          ? (d.vertexNormals[0].copy(e[d.a]),
            d.vertexNormals[1].copy(e[d.b]),
            d.vertexNormals[2].copy(e[d.c]))
          : d instanceof THREE.Face4 &&
            (d.vertexNormals[0].copy(e[d.a]),
            d.vertexNormals[1].copy(e[d.b]),
            d.vertexNormals[2].copy(e[d.c]),
            d.vertexNormals[3].copy(e[d.d]));
  },
  computeMorphNormals: function () {
    var a, b, c, d, e;
    c = 0;
    for (d = this.faces.length; c < d; c++) {
      e = this.faces[c];
      e.__originalFaceNormal
        ? e.__originalFaceNormal.copy(e.normal)
        : (e.__originalFaceNormal = e.normal.clone());
      e.__originalVertexNormals || (e.__originalVertexNormals = []);
      a = 0;
      for (b = e.vertexNormals.length; a < b; a++)
        e.__originalVertexNormals[a]
          ? e.__originalVertexNormals[a].copy(e.vertexNormals[a])
          : (e.__originalVertexNormals[a] = e.vertexNormals[a].clone());
    }
    var f = new THREE.Geometry();
    f.faces = this.faces;
    a = 0;
    for (b = this.morphTargets.length; a < b; a++) {
      if (!this.morphNormals[a]) {
        this.morphNormals[a] = {};
        this.morphNormals[a].faceNormals = [];
        this.morphNormals[a].vertexNormals = [];
        var g = this.morphNormals[a].faceNormals,
          h = this.morphNormals[a].vertexNormals,
          i,
          j;
        c = 0;
        for (d = this.faces.length; c < d; c++)
          (e = this.faces[c]),
            (i = new THREE.Vector3()),
            (j =
              e instanceof THREE.Face3
                ? {
                    a: new THREE.Vector3(),
                    b: new THREE.Vector3(),
                    c: new THREE.Vector3(),
                  }
                : {
                    a: new THREE.Vector3(),
                    b: new THREE.Vector3(),
                    c: new THREE.Vector3(),
                    d: new THREE.Vector3(),
                  }),
            g.push(i),
            h.push(j);
      }
      g = this.morphNormals[a];
      f.vertices = this.morphTargets[a].vertices;
      f.computeFaceNormals();
      f.computeVertexNormals();
      c = 0;
      for (d = this.faces.length; c < d; c++)
        (e = this.faces[c]),
          (i = g.faceNormals[c]),
          (j = g.vertexNormals[c]),
          i.copy(e.normal),
          e instanceof THREE.Face3
            ? (j.a.copy(e.vertexNormals[0]),
              j.b.copy(e.vertexNormals[1]),
              j.c.copy(e.vertexNormals[2]))
            : (j.a.copy(e.vertexNormals[0]),
              j.b.copy(e.vertexNormals[1]),
              j.c.copy(e.vertexNormals[2]),
              j.d.copy(e.vertexNormals[3]));
    }
    c = 0;
    for (d = this.faces.length; c < d; c++)
      (e = this.faces[c]),
        (e.normal = e.__originalFaceNormal),
        (e.vertexNormals = e.__originalVertexNormals);
  },
  computeTangents: function () {
    function a(a, b, c, d, e, f, z) {
      h = a.vertices[b];
      i = a.vertices[c];
      j = a.vertices[d];
      m = g[e];
      p = g[f];
      l = g[z];
      r = i.x - h.x;
      s = j.x - h.x;
      n = i.y - h.y;
      q = j.y - h.y;
      y = i.z - h.z;
      u = j.z - h.z;
      x = p.x - m.x;
      t = l.x - m.x;
      E = p.y - m.y;
      J = l.y - m.y;
      F = 1 / (x * J - t * E);
      G.set((J * r - E * s) * F, (J * n - E * q) * F, (J * y - E * u) * F);
      L.set((x * s - t * r) * F, (x * q - t * n) * F, (x * u - t * y) * F);
      H[b].add(G);
      H[c].add(G);
      H[d].add(G);
      K[b].add(L);
      K[c].add(L);
      K[d].add(L);
    }
    var b,
      c,
      d,
      e,
      f,
      g,
      h,
      i,
      j,
      m,
      p,
      l,
      r,
      s,
      n,
      q,
      y,
      u,
      x,
      t,
      E,
      J,
      F,
      z,
      H = [],
      K = [],
      G = new THREE.Vector3(),
      L = new THREE.Vector3(),
      B = new THREE.Vector3(),
      V = new THREE.Vector3(),
      C = new THREE.Vector3();
    b = 0;
    for (c = this.vertices.length; b < c; b++)
      (H[b] = new THREE.Vector3()), (K[b] = new THREE.Vector3());
    b = 0;
    for (c = this.faces.length; b < c; b++)
      (f = this.faces[b]),
        (g = this.faceVertexUvs[0][b]),
        f instanceof THREE.Face3
          ? a(this, f.a, f.b, f.c, 0, 1, 2)
          : f instanceof THREE.Face4 &&
            (a(this, f.a, f.b, f.d, 0, 1, 3), a(this, f.b, f.c, f.d, 1, 2, 3));
    var I = ["a", "b", "c", "d"];
    b = 0;
    for (c = this.faces.length; b < c; b++) {
      f = this.faces[b];
      for (d = 0; d < f.vertexNormals.length; d++)
        C.copy(f.vertexNormals[d]),
          (e = f[I[d]]),
          (z = H[e]),
          B.copy(z),
          B.sub(C.multiplyScalar(C.dot(z))).normalize(),
          V.crossVectors(f.vertexNormals[d], z),
          (e = V.dot(K[e])),
          (e = 0 > e ? -1 : 1),
          (f.vertexTangents[d] = new THREE.Vector4(B.x, B.y, B.z, e));
    }
    this.hasTangents = !0;
  },
  computeLineDistances: function () {
    for (var a = 0, b = this.vertices, c = 0, d = b.length; c < d; c++)
      0 < c && (a += b[c].distanceTo(b[c - 1])), (this.lineDistances[c] = a);
  },
  computeBoundingBox: function () {
    null === this.boundingBox && (this.boundingBox = new THREE.Box3());
    this.boundingBox.setFromPoints(this.vertices);
  },
  computeBoundingSphere: function () {
    null === this.boundingSphere && (this.boundingSphere = new THREE.Sphere());
    this.boundingSphere.setFromCenterAndPoints(
      this.boundingSphere.center,
      this.vertices
    );
  },
  mergeVertices: function () {
    var a = {},
      b = [],
      c = [],
      d,
      e = Math.pow(10, 4),
      f,
      g,
      h,
      i,
      j;
    this.__tmpVertices = void 0;
    f = 0;
    for (g = this.vertices.length; f < g; f++)
      (d = this.vertices[f]),
        (d = [
          Math.round(d.x * e),
          Math.round(d.y * e),
          Math.round(d.z * e),
        ].join("_")),
        void 0 === a[d]
          ? ((a[d] = f), b.push(this.vertices[f]), (c[f] = b.length - 1))
          : (c[f] = c[a[d]]);
    e = [];
    f = 0;
    for (g = this.faces.length; f < g; f++)
      if (((a = this.faces[f]), a instanceof THREE.Face3)) {
        a.a = c[a.a];
        a.b = c[a.b];
        a.c = c[a.c];
        h = [a.a, a.b, a.c];
        d = -1;
        for (i = 0; 3 > i; i++)
          if (h[i] == h[(i + 1) % 3]) {
            e.push(f);
            break;
          }
      } else if (a instanceof THREE.Face4) {
        a.a = c[a.a];
        a.b = c[a.b];
        a.c = c[a.c];
        a.d = c[a.d];
        h = [a.a, a.b, a.c, a.d];
        d = -1;
        for (i = 0; 4 > i; i++)
          h[i] == h[(i + 1) % 4] && (0 <= d && e.push(f), (d = i));
        if (0 <= d) {
          h.splice(d, 1);
          var m = new THREE.Face3(
            h[0],
            h[1],
            h[2],
            a.normal,
            a.color,
            a.materialIndex
          );
          h = 0;
          for (i = this.faceVertexUvs.length; h < i; h++)
            (j = this.faceVertexUvs[h][f]) && j.splice(d, 1);
          a.vertexNormals &&
            0 < a.vertexNormals.length &&
            ((m.vertexNormals = a.vertexNormals), m.vertexNormals.splice(d, 1));
          a.vertexColors &&
            0 < a.vertexColors.length &&
            ((m.vertexColors = a.vertexColors), m.vertexColors.splice(d, 1));
          this.faces[f] = m;
        }
      }
    for (f = e.length - 1; 0 <= f; f--) {
      this.faces.splice(f, 1);
      h = 0;
      for (i = this.faceVertexUvs.length; h < i; h++)
        this.faceVertexUvs[h].splice(f, 1);
    }
    c = this.vertices.length - b.length;
    this.vertices = b;
    return c;
  },
  clone: function () {
    for (
      var a = new THREE.Geometry(), b = this.vertices, c = 0, d = b.length;
      c < d;
      c++
    )
      a.vertices.push(b[c].clone());
    b = this.faces;
    c = 0;
    for (d = b.length; c < d; c++) a.faces.push(b[c].clone());
    b = this.faceVertexUvs[0];
    c = 0;
    for (d = b.length; c < d; c++) {
      for (var e = b[c], f = [], g = 0, h = e.length; g < h; g++)
        f.push(new THREE.Vector2(e[g].x, e[g].y));
      a.faceVertexUvs[0].push(f);
    }
    return a;
  },
  dispose: function () {
    this.dispatchEvent({ type: "dispose" });
  },
};
THREE.GeometryIdCount = 0;
THREE.BufferGeometry = function () {
  this.id = THREE.GeometryIdCount++;
  this.attributes = {};
  this.dynamic = !1;
  this.offsets = [];
  this.boundingSphere = this.boundingBox = null;
  this.hasTangents = !1;
  this.morphTargets = [];
};
THREE.BufferGeometry.prototype = {
  constructor: THREE.BufferGeometry,
  addEventListener: THREE.EventDispatcher.prototype.addEventListener,
  hasEventListener: THREE.EventDispatcher.prototype.hasEventListener,
  removeEventListener: THREE.EventDispatcher.prototype.removeEventListener,
  dispatchEvent: THREE.EventDispatcher.prototype.dispatchEvent,
  applyMatrix: function (a) {
    var b, c;
    this.attributes.position && (b = this.attributes.position.array);
    this.attributes.normal && (c = this.attributes.normal.array);
    void 0 !== b && (a.multiplyVector3Array(b), (this.verticesNeedUpdate = !0));
    void 0 !== c &&
      (new THREE.Matrix3().getNormalMatrix(a).multiplyVector3Array(c),
      this.normalizeNormals(),
      (this.normalsNeedUpdate = !0));
  },
  computeBoundingBox: function () {
    null === this.boundingBox && (this.boundingBox = new THREE.Box3());
    var a = this.attributes.position.array;
    if (a) {
      var b = this.boundingBox,
        c,
        d,
        e;
      3 <= a.length &&
        ((b.min.x = b.max.x = a[0]),
        (b.min.y = b.max.y = a[1]),
        (b.min.z = b.max.z = a[2]));
      for (var f = 3, g = a.length; f < g; f += 3)
        (c = a[f]),
          (d = a[f + 1]),
          (e = a[f + 2]),
          c < b.min.x ? (b.min.x = c) : c > b.max.x && (b.max.x = c),
          d < b.min.y ? (b.min.y = d) : d > b.max.y && (b.max.y = d),
          e < b.min.z ? (b.min.z = e) : e > b.max.z && (b.max.z = e);
    }
    if (void 0 === a || 0 === a.length)
      this.boundingBox.min.set(0, 0, 0), this.boundingBox.max.set(0, 0, 0);
  },
  computeBoundingSphere: function () {
    null === this.boundingSphere && (this.boundingSphere = new THREE.Sphere());
    var a = this.attributes.position.array;
    if (a) {
      for (var b, c = 0, d, e, f = 0, g = a.length; f < g; f += 3)
        (b = a[f]),
          (d = a[f + 1]),
          (e = a[f + 2]),
          (b = b * b + d * d + e * e),
          b > c && (c = b);
      this.boundingSphere.radius = Math.sqrt(c);
    }
  },
  computeVertexNormals: function () {
    if (this.attributes.position) {
      var a, b, c, d;
      a = this.attributes.position.array.length;
      if (void 0 === this.attributes.normal)
        this.attributes.normal = {
          itemSize: 3,
          array: new Float32Array(a),
          numItems: a,
        };
      else {
        a = 0;
        for (b = this.attributes.normal.array.length; a < b; a++)
          this.attributes.normal.array[a] = 0;
      }
      var e = this.attributes.position.array,
        f = this.attributes.normal.array,
        g,
        h,
        i,
        j,
        m,
        p,
        l = new THREE.Vector3(),
        r = new THREE.Vector3(),
        s = new THREE.Vector3(),
        n = new THREE.Vector3(),
        q = new THREE.Vector3();
      if (this.attributes.index) {
        var y = this.attributes.index.array,
          u = this.offsets;
        c = 0;
        for (d = u.length; c < d; ++c) {
          b = u[c].start;
          g = u[c].count;
          var x = u[c].index;
          a = b;
          for (b += g; a < b; a += 3)
            (g = x + y[a]),
              (h = x + y[a + 1]),
              (i = x + y[a + 2]),
              (j = e[3 * g]),
              (m = e[3 * g + 1]),
              (p = e[3 * g + 2]),
              l.set(j, m, p),
              (j = e[3 * h]),
              (m = e[3 * h + 1]),
              (p = e[3 * h + 2]),
              r.set(j, m, p),
              (j = e[3 * i]),
              (m = e[3 * i + 1]),
              (p = e[3 * i + 2]),
              s.set(j, m, p),
              n.subVectors(s, r),
              q.subVectors(l, r),
              n.cross(q),
              (f[3 * g] += n.x),
              (f[3 * g + 1] += n.y),
              (f[3 * g + 2] += n.z),
              (f[3 * h] += n.x),
              (f[3 * h + 1] += n.y),
              (f[3 * h + 2] += n.z),
              (f[3 * i] += n.x),
              (f[3 * i + 1] += n.y),
              (f[3 * i + 2] += n.z);
        }
      } else {
        a = 0;
        for (b = e.length; a < b; a += 9)
          (j = e[a]),
            (m = e[a + 1]),
            (p = e[a + 2]),
            l.set(j, m, p),
            (j = e[a + 3]),
            (m = e[a + 4]),
            (p = e[a + 5]),
            r.set(j, m, p),
            (j = e[a + 6]),
            (m = e[a + 7]),
            (p = e[a + 8]),
            s.set(j, m, p),
            n.subVectors(s, r),
            q.subVectors(l, r),
            n.cross(q),
            (f[a] = n.x),
            (f[a + 1] = n.y),
            (f[a + 2] = n.z),
            (f[a + 3] = n.x),
            (f[a + 4] = n.y),
            (f[a + 5] = n.z),
            (f[a + 6] = n.x),
            (f[a + 7] = n.y),
            (f[a + 8] = n.z);
      }
      this.normalizeNormals();
      this.normalsNeedUpdate = !0;
    }
  },
  normalizeNormals: function () {
    for (
      var a = this.attributes.normal.array, b, c, d, e = 0, f = a.length;
      e < f;
      e += 3
    )
      (b = a[e]),
        (c = a[e + 1]),
        (d = a[e + 2]),
        (b = 1 / Math.sqrt(b * b + c * c + d * d)),
        (a[e] *= b),
        (a[e + 1] *= b),
        (a[e + 2] *= b);
  },
  computeTangents: function () {
    function a(a) {
      wa.x = d[3 * a];
      wa.y = d[3 * a + 1];
      wa.z = d[3 * a + 2];
      Ma.copy(wa);
      ca = i[a];
      R.copy(ca);
      R.sub(wa.multiplyScalar(wa.dot(ca))).normalize();
      ea.crossVectors(Ma, ca);
      ja = ea.dot(j[a]);
      A = 0 > ja ? -1 : 1;
      h[4 * a] = R.x;
      h[4 * a + 1] = R.y;
      h[4 * a + 2] = R.z;
      h[4 * a + 3] = A;
    }
    if (
      void 0 === this.attributes.index ||
      void 0 === this.attributes.position ||
      void 0 === this.attributes.normal ||
      void 0 === this.attributes.uv
    )
      console.warn(
        "Missing required attributes (index, position, normal or uv) in BufferGeometry.computeTangents()"
      );
    else {
      var b = this.attributes.index.array,
        c = this.attributes.position.array,
        d = this.attributes.normal.array,
        e = this.attributes.uv.array,
        f = c.length / 3;
      if (void 0 === this.attributes.tangent) {
        var g = 4 * f;
        this.attributes.tangent = {
          itemSize: 4,
          array: new Float32Array(g),
          numItems: g,
        };
      }
      for (
        var h = this.attributes.tangent.array, i = [], j = [], g = 0;
        g < f;
        g++
      )
        (i[g] = new THREE.Vector3()), (j[g] = new THREE.Vector3());
      var m,
        p,
        l,
        r,
        s,
        n,
        q,
        y,
        u,
        x,
        t,
        E,
        J,
        F,
        z,
        f = new THREE.Vector3(),
        g = new THREE.Vector3(),
        H,
        K,
        G,
        L,
        B,
        V,
        C,
        I = this.offsets;
      G = 0;
      for (L = I.length; G < L; ++G) {
        K = I[G].start;
        B = I[G].count;
        var M = I[G].index;
        H = K;
        for (K += B; H < K; H += 3)
          (B = M + b[H]),
            (V = M + b[H + 1]),
            (C = M + b[H + 2]),
            (m = c[3 * B]),
            (p = c[3 * B + 1]),
            (l = c[3 * B + 2]),
            (r = c[3 * V]),
            (s = c[3 * V + 1]),
            (n = c[3 * V + 2]),
            (q = c[3 * C]),
            (y = c[3 * C + 1]),
            (u = c[3 * C + 2]),
            (x = e[2 * B]),
            (t = e[2 * B + 1]),
            (E = e[2 * V]),
            (J = e[2 * V + 1]),
            (F = e[2 * C]),
            (z = e[2 * C + 1]),
            (r -= m),
            (m = q - m),
            (s -= p),
            (p = y - p),
            (n -= l),
            (l = u - l),
            (E -= x),
            (x = F - x),
            (J -= t),
            (t = z - t),
            (z = 1 / (E * t - x * J)),
            f.set(
              (t * r - J * m) * z,
              (t * s - J * p) * z,
              (t * n - J * l) * z
            ),
            g.set(
              (E * m - x * r) * z,
              (E * p - x * s) * z,
              (E * l - x * n) * z
            ),
            i[B].add(f),
            i[V].add(f),
            i[C].add(f),
            j[B].add(g),
            j[V].add(g),
            j[C].add(g);
      }
      var R = new THREE.Vector3(),
        ea = new THREE.Vector3(),
        wa = new THREE.Vector3(),
        Ma = new THREE.Vector3(),
        A,
        ca,
        ja;
      G = 0;
      for (L = I.length; G < L; ++G) {
        K = I[G].start;
        B = I[G].count;
        M = I[G].index;
        H = K;
        for (K += B; H < K; H += 3)
          (B = M + b[H]),
            (V = M + b[H + 1]),
            (C = M + b[H + 2]),
            a(B),
            a(V),
            a(C);
      }
      this.tangentsNeedUpdate = this.hasTangents = !0;
    }
  },
  dispose: function () {
    this.dispatchEvent({ type: "dispose" });
  },
};
THREE.Camera = function () {
  THREE.Object3D.call(this);
  this.matrixWorldInverse = new THREE.Matrix4();
  this.projectionMatrix = new THREE.Matrix4();
  this.projectionMatrixInverse = new THREE.Matrix4();
};
THREE.Camera.prototype = Object.create(THREE.Object3D.prototype);
THREE.Camera.prototype.lookAt = (function () {
  var a = new THREE.Matrix4();
  return function (b) {
    a.lookAt(this.position, b, this.up);
    !0 === this.useQuaternion
      ? this.quaternion.setFromRotationMatrix(a)
      : this.rotation.setEulerFromRotationMatrix(a, this.eulerOrder);
  };
})();
THREE.OrthographicCamera = function (a, b, c, d, e, f) {
  THREE.Camera.call(this);
  this.left = a;
  this.right = b;
  this.top = c;
  this.bottom = d;
  this.near = void 0 !== e ? e : 0.1;
  this.far = void 0 !== f ? f : 2e3;
  this.updateProjectionMatrix();
};
THREE.OrthographicCamera.prototype = Object.create(THREE.Camera.prototype);
THREE.OrthographicCamera.prototype.updateProjectionMatrix = function () {
  this.projectionMatrix.makeOrthographic(
    this.left,
    this.right,
    this.top,
    this.bottom,
    this.near,
    this.far
  );
};
THREE.PerspectiveCamera = function (a, b, c, d) {
  THREE.Camera.call(this);
  this.fov = void 0 !== a ? a : 50;
  this.aspect = void 0 !== b ? b : 1;
  this.near = void 0 !== c ? c : 0.1;
  this.far = void 0 !== d ? d : 2e3;
  this.updateProjectionMatrix();
};
THREE.PerspectiveCamera.prototype = Object.create(THREE.Camera.prototype);
THREE.PerspectiveCamera.prototype.setLens = function (a, b) {
  void 0 === b && (b = 24);
  this.fov = 2 * THREE.Math.radToDeg(Math.atan(b / (2 * a)));
  this.updateProjectionMatrix();
};
THREE.PerspectiveCamera.prototype.setViewOffset = function (a, b, c, d, e, f) {
  this.fullWidth = a;
  this.fullHeight = b;
  this.x = c;
  this.y = d;
  this.width = e;
  this.height = f;
  this.updateProjectionMatrix();
};
THREE.PerspectiveCamera.prototype.updateProjectionMatrix = function () {
  if (this.fullWidth) {
    var a = this.fullWidth / this.fullHeight,
      b = Math.tan(THREE.Math.degToRad(0.5 * this.fov)) * this.near,
      c = -b,
      d = a * c,
      a = Math.abs(a * b - d),
      c = Math.abs(b - c);
    this.projectionMatrix.makeFrustum(
      d + (this.x * a) / this.fullWidth,
      d + ((this.x + this.width) * a) / this.fullWidth,
      b - ((this.y + this.height) * c) / this.fullHeight,
      b - (this.y * c) / this.fullHeight,
      this.near,
      this.far
    );
  } else
    this.projectionMatrix.makePerspective(
      this.fov,
      this.aspect,
      this.near,
      this.far
    );
};
THREE.Light = function (a) {
  THREE.Object3D.call(this);
  this.color = new THREE.Color(a);
};
THREE.Light.prototype = Object.create(THREE.Object3D.prototype);
THREE.Light.prototype.clone = function (a) {
  void 0 === a && (a = new THREE.Light());
  THREE.Object3D.prototype.clone.call(this, a);
  a.color.copy(this.color);
  return a;
};
THREE.AmbientLight = function (a) {
  THREE.Light.call(this, a);
};
THREE.AmbientLight.prototype = Object.create(THREE.Light.prototype);
THREE.AmbientLight.prototype.clone = function () {
  var a = new THREE.AmbientLight();
  THREE.Light.prototype.clone.call(this, a);
  return a;
};
THREE.AreaLight = function (a, b) {
  THREE.Light.call(this, a);
  this.normal = new THREE.Vector3(0, -1, 0);
  this.right = new THREE.Vector3(1, 0, 0);
  this.intensity = void 0 !== b ? b : 1;
  this.height = this.width = 1;
  this.constantAttenuation = 1.5;
  this.linearAttenuation = 0.5;
  this.quadraticAttenuation = 0.1;
};
THREE.AreaLight.prototype = Object.create(THREE.Light.prototype);
THREE.DirectionalLight = function (a, b) {
  THREE.Light.call(this, a);
  this.position.set(0, 1, 0);
  this.target = new THREE.Object3D();
  this.intensity = void 0 !== b ? b : 1;
  this.onlyShadow = this.castShadow = !1;
  this.shadowCameraNear = 50;
  this.shadowCameraFar = 5e3;
  this.shadowCameraLeft = -500;
  this.shadowCameraTop = this.shadowCameraRight = 500;
  this.shadowCameraBottom = -500;
  this.shadowCameraVisible = !1;
  this.shadowBias = 0;
  this.shadowDarkness = 0.5;
  this.shadowMapHeight = this.shadowMapWidth = 512;
  this.shadowCascade = !1;
  this.shadowCascadeOffset = new THREE.Vector3(0, 0, -1e3);
  this.shadowCascadeCount = 2;
  this.shadowCascadeBias = [0, 0, 0];
  this.shadowCascadeWidth = [512, 512, 512];
  this.shadowCascadeHeight = [512, 512, 512];
  this.shadowCascadeNearZ = [-1, 0.99, 0.998];
  this.shadowCascadeFarZ = [0.99, 0.998, 1];
  this.shadowCascadeArray = [];
  this.shadowMatrix =
    this.shadowCamera =
    this.shadowMapSize =
    this.shadowMap =
      null;
};
THREE.DirectionalLight.prototype = Object.create(THREE.Light.prototype);
THREE.DirectionalLight.prototype.clone = function () {
  var a = new THREE.DirectionalLight();
  THREE.Light.prototype.clone.call(this, a);
  a.target = this.target.clone();
  a.intensity = this.intensity;
  a.castShadow = this.castShadow;
  a.onlyShadow = this.onlyShadow;
  return a;
};
THREE.HemisphereLight = function (a, b, c) {
  THREE.Light.call(this, a);
  this.position.set(0, 100, 0);
  this.groundColor = new THREE.Color(b);
  this.intensity = void 0 !== c ? c : 1;
};
THREE.HemisphereLight.prototype = Object.create(THREE.Light.prototype);
THREE.HemisphereLight.prototype.clone = function () {
  var a = new THREE.PointLight();
  THREE.Light.prototype.clone.call(this, a);
  a.groundColor.copy(this.groundColor);
  a.intensity = this.intensity;
  return a;
};
THREE.PointLight = function (a, b, c) {
  THREE.Light.call(this, a);
  this.intensity = void 0 !== b ? b : 1;
  this.distance = void 0 !== c ? c : 0;
};
THREE.PointLight.prototype = Object.create(THREE.Light.prototype);
THREE.PointLight.prototype.clone = function () {
  var a = new THREE.PointLight();
  THREE.Light.prototype.clone.call(this, a);
  a.intensity = this.intensity;
  a.distance = this.distance;
  return a;
};
THREE.SpotLight = function (a, b, c, d, e) {
  THREE.Light.call(this, a);
  this.position.set(0, 1, 0);
  this.target = new THREE.Object3D();
  this.intensity = void 0 !== b ? b : 1;
  this.distance = void 0 !== c ? c : 0;
  this.angle = void 0 !== d ? d : Math.PI / 3;
  this.exponent = void 0 !== e ? e : 10;
  this.onlyShadow = this.castShadow = !1;
  this.shadowCameraNear = 50;
  this.shadowCameraFar = 5e3;
  this.shadowCameraFov = 50;
  this.shadowCameraVisible = !1;
  this.shadowBias = 0;
  this.shadowDarkness = 0.5;
  this.shadowMapHeight = this.shadowMapWidth = 512;
  this.shadowMatrix =
    this.shadowCamera =
    this.shadowMapSize =
    this.shadowMap =
      null;
};
THREE.SpotLight.prototype = Object.create(THREE.Light.prototype);
THREE.SpotLight.prototype.clone = function () {
  var a = new THREE.SpotLight();
  THREE.Light.prototype.clone.call(this, a);
  a.target = this.target.clone();
  a.intensity = this.intensity;
  a.distance = this.distance;
  a.angle = this.angle;
  a.exponent = this.exponent;
  a.castShadow = this.castShadow;
  a.onlyShadow = this.onlyShadow;
  return a;
};
THREE.Loader = function (a) {
  this.statusDomElement = (this.showStatus = a)
    ? THREE.Loader.prototype.addStatusElement()
    : null;
  this.onLoadStart = function () {};
  this.onLoadProgress = function () {};
  this.onLoadComplete = function () {};
};
THREE.Loader.prototype = {
  constructor: THREE.Loader,
  crossOrigin: "anonymous",
  addStatusElement: function () {
    var a = document.createElement("div");
    a.style.position = "absolute";
    a.style.right = "0px";
    a.style.top = "0px";
    a.style.fontSize = "0.8em";
    a.style.textAlign = "left";
    a.style.background = "rgba(0,0,0,0.25)";
    a.style.color = "#fff";
    a.style.width = "120px";
    a.style.padding = "0.5em 0.5em 0.5em 0.5em";
    a.style.zIndex = 1e3;
    a.innerHTML = "Loading ...";
    return a;
  },
  updateProgress: function (a) {
    var b = "Loaded ",
      b = a.total
        ? b + (((100 * a.loaded) / a.total).toFixed(0) + "%")
        : b + ((a.loaded / 1e3).toFixed(2) + " KB");
    this.statusDomElement.innerHTML = b;
  },
  extractUrlBase: function (a) {
    a = a.split("/");
    a.pop();
    return (1 > a.length ? "." : a.join("/")) + "/";
  },
  initMaterials: function (a, b) {
    for (var c = [], d = 0; d < a.length; ++d)
      c[d] = THREE.Loader.prototype.createMaterial(a[d], b);
    return c;
  },
  needsTangents: function (a) {
    for (var b = 0, c = a.length; b < c; b++)
      if (a[b] instanceof THREE.ShaderMaterial) return !0;
    return !1;
  },
  createMaterial: function (a, b) {
    function c(a) {
      a = Math.log(a) / Math.LN2;
      return Math.floor(a) == a;
    }
    function d(a) {
      a = Math.log(a) / Math.LN2;
      return Math.pow(2, Math.round(a));
    }
    function e(a, e, f, h, i, j, q) {
      var y = /\.dds$/i.test(f),
        u = b + "/" + f;
      if (y) {
        var x = THREE.ImageUtils.loadCompressedTexture(u);
        a[e] = x;
      } else
        (x = document.createElement("canvas")), (a[e] = new THREE.Texture(x));
      a[e].sourceFile = f;
      h &&
        (a[e].repeat.set(h[0], h[1]),
        1 !== h[0] && (a[e].wrapS = THREE.RepeatWrapping),
        1 !== h[1] && (a[e].wrapT = THREE.RepeatWrapping));
      i && a[e].offset.set(i[0], i[1]);
      j &&
        ((f = {
          repeat: THREE.RepeatWrapping,
          mirror: THREE.MirroredRepeatWrapping,
        }),
        void 0 !== f[j[0]] && (a[e].wrapS = f[j[0]]),
        void 0 !== f[j[1]] && (a[e].wrapT = f[j[1]]));
      q && (a[e].anisotropy = q);
      if (!y) {
        var t = a[e],
          a = new Image();
        a.onload = function () {
          if (!c(this.width) || !c(this.height)) {
            var a = d(this.width),
              b = d(this.height);
            t.image.width = a;
            t.image.height = b;
            t.image.getContext("2d").drawImage(this, 0, 0, a, b);
          } else t.image = this;
          t.needsUpdate = !0;
        };
        a.crossOrigin = g.crossOrigin;
        a.src = u;
      }
    }
    function f(a) {
      return ((255 * a[0]) << 16) + ((255 * a[1]) << 8) + 255 * a[2];
    }
    var g = this,
      h = "MeshLambertMaterial",
      i = {
        color: 15658734,
        opacity: 1,
        map: null,
        lightMap: null,
        normalMap: null,
        bumpMap: null,
        wireframe: !1,
      };
    if (a.shading) {
      var j = a.shading.toLowerCase();
      "phong" === j
        ? (h = "MeshPhongMaterial")
        : "basic" === j && (h = "MeshBasicMaterial");
    }
    void 0 !== a.blending &&
      void 0 !== THREE[a.blending] &&
      (i.blending = THREE[a.blending]);
    if (void 0 !== a.transparent || 1 > a.opacity)
      i.transparent = a.transparent;
    void 0 !== a.depthTest && (i.depthTest = a.depthTest);
    void 0 !== a.depthWrite && (i.depthWrite = a.depthWrite);
    void 0 !== a.visible && (i.visible = a.visible);
    void 0 !== a.flipSided && (i.side = THREE.BackSide);
    void 0 !== a.doubleSided && (i.side = THREE.DoubleSide);
    void 0 !== a.wireframe && (i.wireframe = a.wireframe);
    void 0 !== a.vertexColors &&
      ("face" === a.vertexColors
        ? (i.vertexColors = THREE.FaceColors)
        : a.vertexColors && (i.vertexColors = THREE.VertexColors));
    a.colorDiffuse
      ? (i.color = f(a.colorDiffuse))
      : a.DbgColor && (i.color = a.DbgColor);
    a.colorSpecular && (i.specular = f(a.colorSpecular));
    a.colorAmbient && (i.ambient = f(a.colorAmbient));
    a.transparency && (i.opacity = a.transparency);
    a.specularCoef && (i.shininess = a.specularCoef);
    a.mapDiffuse &&
      b &&
      e(
        i,
        "map",
        a.mapDiffuse,
        a.mapDiffuseRepeat,
        a.mapDiffuseOffset,
        a.mapDiffuseWrap,
        a.mapDiffuseAnisotropy
      );
    a.mapLight &&
      b &&
      e(
        i,
        "lightMap",
        a.mapLight,
        a.mapLightRepeat,
        a.mapLightOffset,
        a.mapLightWrap,
        a.mapLightAnisotropy
      );
    a.mapBump &&
      b &&
      e(
        i,
        "bumpMap",
        a.mapBump,
        a.mapBumpRepeat,
        a.mapBumpOffset,
        a.mapBumpWrap,
        a.mapBumpAnisotropy
      );
    a.mapNormal &&
      b &&
      e(
        i,
        "normalMap",
        a.mapNormal,
        a.mapNormalRepeat,
        a.mapNormalOffset,
        a.mapNormalWrap,
        a.mapNormalAnisotropy
      );
    a.mapSpecular &&
      b &&
      e(
        i,
        "specularMap",
        a.mapSpecular,
        a.mapSpecularRepeat,
        a.mapSpecularOffset,
        a.mapSpecularWrap,
        a.mapSpecularAnisotropy
      );
    a.mapBumpScale && (i.bumpScale = a.mapBumpScale);
    a.mapNormal
      ? ((h = THREE.ShaderLib.normalmap),
        (j = THREE.UniformsUtils.clone(h.uniforms)),
        (j.tNormal.value = i.normalMap),
        a.mapNormalFactor &&
          j.uNormalScale.value.set(a.mapNormalFactor, a.mapNormalFactor),
        i.map && ((j.tDiffuse.value = i.map), (j.enableDiffuse.value = !0)),
        i.specularMap &&
          ((j.tSpecular.value = i.specularMap), (j.enableSpecular.value = !0)),
        i.lightMap && ((j.tAO.value = i.lightMap), (j.enableAO.value = !0)),
        j.uDiffuseColor.value.setHex(i.color),
        j.uSpecularColor.value.setHex(i.specular),
        j.uAmbientColor.value.setHex(i.ambient),
        (j.uShininess.value = i.shininess),
        void 0 !== i.opacity && (j.uOpacity.value = i.opacity),
        (h = new THREE.ShaderMaterial({
          fragmentShader: h.fragmentShader,
          vertexShader: h.vertexShader,
          uniforms: j,
          lights: !0,
          fog: !0,
        })),
        i.transparent && (h.transparent = !0))
      : (h = new THREE[h](i));
    void 0 !== a.DbgName && (h.name = a.DbgName);
    return h;
  },
};
THREE.ImageLoader = function () {
  this.crossOrigin = null;
};
THREE.ImageLoader.prototype = {
  constructor: THREE.ImageLoader,
  addEventListener: THREE.EventDispatcher.prototype.addEventListener,
  hasEventListener: THREE.EventDispatcher.prototype.hasEventListener,
  removeEventListener: THREE.EventDispatcher.prototype.removeEventListener,
  dispatchEvent: THREE.EventDispatcher.prototype.dispatchEvent,
  load: function (a, b) {
    var c = this;
    void 0 === b && (b = new Image());
    b.addEventListener(
      "load",
      function () {
        c.dispatchEvent({ type: "load", content: b });
      },
      !1
    );
    b.addEventListener(
      "error",
      function () {
        c.dispatchEvent({
          type: "error",
          message: "Couldn't load URL [" + a + "]",
        });
      },
      !1
    );
    c.crossOrigin && (b.crossOrigin = c.crossOrigin);
    b.src = a;
  },
};
THREE.JSONLoader = function (a) {
  THREE.Loader.call(this, a);
  this.withCredentials = !1;
};
THREE.JSONLoader.prototype = Object.create(THREE.Loader.prototype);
THREE.JSONLoader.prototype.load = function (a, b, c) {
  c = c && "string" === typeof c ? c : this.extractUrlBase(a);
  this.onLoadStart();
  this.loadAjaxJSON(this, a, b, c);
};
THREE.JSONLoader.prototype.loadAjaxJSON = function (a, b, c, d, e) {
  var f = new XMLHttpRequest(),
    g = 0;
  f.onreadystatechange = function () {
    if (f.readyState === f.DONE)
      if (200 === f.status || 0 === f.status) {
        if (f.responseText) {
          var h = JSON.parse(f.responseText),
            h = a.parse(h, d);
          c(h.geometry, h.materials);
        } else
          console.warn(
            "THREE.JSONLoader: [" +
              b +
              "] seems to be unreachable or file there is empty"
          );
        a.onLoadComplete();
      } else
        console.error(
          "THREE.JSONLoader: Couldn't load [" + b + "] [" + f.status + "]"
        );
    else
      f.readyState === f.LOADING
        ? e &&
          (0 === g && (g = f.getResponseHeader("Content-Length")),
          e({ total: g, loaded: f.responseText.length }))
        : f.readyState === f.HEADERS_RECEIVED &&
          void 0 !== e &&
          (g = f.getResponseHeader("Content-Length"));
  };
  f.open("GET", b, !0);
  f.withCredentials = this.withCredentials;
  f.send(null);
};
THREE.JSONLoader.prototype.parse = function (a, b) {
  var c = new THREE.Geometry(),
    d = void 0 !== a.scale ? 1 / a.scale : 1,
    e,
    f,
    g,
    h,
    i,
    j,
    m,
    p,
    l,
    r,
    s,
    n,
    q,
    y,
    u,
    x = a.faces;
  r = a.vertices;
  var t = a.normals,
    E = a.colors,
    J = 0;
  for (e = 0; e < a.uvs.length; e++) a.uvs[e].length && J++;
  for (e = 0; e < J; e++) (c.faceUvs[e] = []), (c.faceVertexUvs[e] = []);
  h = 0;
  for (i = r.length; h < i; )
    (j = new THREE.Vector3()),
      (j.x = r[h++] * d),
      (j.y = r[h++] * d),
      (j.z = r[h++] * d),
      c.vertices.push(j);
  h = 0;
  for (i = x.length; h < i; ) {
    r = x[h++];
    j = r & 1;
    g = r & 2;
    e = r & 4;
    f = r & 8;
    p = r & 16;
    m = r & 32;
    s = r & 64;
    r &= 128;
    j
      ? ((n = new THREE.Face4()),
        (n.a = x[h++]),
        (n.b = x[h++]),
        (n.c = x[h++]),
        (n.d = x[h++]),
        (j = 4))
      : ((n = new THREE.Face3()),
        (n.a = x[h++]),
        (n.b = x[h++]),
        (n.c = x[h++]),
        (j = 3));
    g && ((g = x[h++]), (n.materialIndex = g));
    g = c.faces.length;
    if (e)
      for (e = 0; e < J; e++)
        (q = a.uvs[e]),
          (l = x[h++]),
          (u = q[2 * l]),
          (l = q[2 * l + 1]),
          (c.faceUvs[e][g] = new THREE.Vector2(u, l));
    if (f)
      for (e = 0; e < J; e++) {
        q = a.uvs[e];
        y = [];
        for (f = 0; f < j; f++)
          (l = x[h++]),
            (u = q[2 * l]),
            (l = q[2 * l + 1]),
            (y[f] = new THREE.Vector2(u, l));
        c.faceVertexUvs[e][g] = y;
      }
    p &&
      ((p = 3 * x[h++]),
      (f = new THREE.Vector3()),
      (f.x = t[p++]),
      (f.y = t[p++]),
      (f.z = t[p]),
      (n.normal = f));
    if (m)
      for (e = 0; e < j; e++)
        (p = 3 * x[h++]),
          (f = new THREE.Vector3()),
          (f.x = t[p++]),
          (f.y = t[p++]),
          (f.z = t[p]),
          n.vertexNormals.push(f);
    s && ((m = x[h++]), (m = new THREE.Color(E[m])), (n.color = m));
    if (r)
      for (e = 0; e < j; e++)
        (m = x[h++]), (m = new THREE.Color(E[m])), n.vertexColors.push(m);
    c.faces.push(n);
  }
  if (a.skinWeights) {
    h = 0;
    for (i = a.skinWeights.length; h < i; h += 2)
      (x = a.skinWeights[h]),
        (t = a.skinWeights[h + 1]),
        c.skinWeights.push(new THREE.Vector4(x, t, 0, 0));
  }
  if (a.skinIndices) {
    h = 0;
    for (i = a.skinIndices.length; h < i; h += 2)
      (x = a.skinIndices[h]),
        (t = a.skinIndices[h + 1]),
        c.skinIndices.push(new THREE.Vector4(x, t, 0, 0));
  }
  c.bones = a.bones;
  c.animation = a.animation;
  if (void 0 !== a.morphTargets) {
    h = 0;
    for (i = a.morphTargets.length; h < i; h++) {
      c.morphTargets[h] = {};
      c.morphTargets[h].name = a.morphTargets[h].name;
      c.morphTargets[h].vertices = [];
      E = c.morphTargets[h].vertices;
      J = a.morphTargets[h].vertices;
      x = 0;
      for (t = J.length; x < t; x += 3)
        (r = new THREE.Vector3()),
          (r.x = J[x] * d),
          (r.y = J[x + 1] * d),
          (r.z = J[x + 2] * d),
          E.push(r);
    }
  }
  if (void 0 !== a.morphColors) {
    h = 0;
    for (i = a.morphColors.length; h < i; h++) {
      c.morphColors[h] = {};
      c.morphColors[h].name = a.morphColors[h].name;
      c.morphColors[h].colors = [];
      t = c.morphColors[h].colors;
      E = a.morphColors[h].colors;
      d = 0;
      for (x = E.length; d < x; d += 3)
        (J = new THREE.Color(16755200)),
          J.setRGB(E[d], E[d + 1], E[d + 2]),
          t.push(J);
    }
  }
  c.computeCentroids();
  c.computeFaceNormals();
  if (void 0 === a.materials) return { geometry: c };
  d = this.initMaterials(a.materials, b);
  this.needsTangents(d) && c.computeTangents();
  return { geometry: c, materials: d };
};
THREE.LoadingMonitor = function () {
  var a = this,
    b = 0,
    c = 0,
    d = function () {
      b++;
      a.dispatchEvent({ type: "progress", loaded: b, total: c });
      b === c && a.dispatchEvent({ type: "load" });
    };
  this.add = function (a) {
    c++;
    a.addEventListener("load", d, !1);
  };
};
THREE.LoadingMonitor.prototype = {
  constructor: THREE.LoadingMonitor,
  addEventListener: THREE.EventDispatcher.prototype.addEventListener,
  hasEventListener: THREE.EventDispatcher.prototype.hasEventListener,
  removeEventListener: THREE.EventDispatcher.prototype.removeEventListener,
  dispatchEvent: THREE.EventDispatcher.prototype.dispatchEvent,
};
THREE.GeometryLoader = function () {};
THREE.GeometryLoader.prototype = {
  constructor: THREE.GeometryLoader,
  addEventListener: THREE.EventDispatcher.prototype.addEventListener,
  hasEventListener: THREE.EventDispatcher.prototype.hasEventListener,
  removeEventListener: THREE.EventDispatcher.prototype.removeEventListener,
  dispatchEvent: THREE.EventDispatcher.prototype.dispatchEvent,
  load: function (a) {
    var b = this,
      c = new XMLHttpRequest();
    c.addEventListener(
      "load",
      function (a) {
        a = b.parse(JSON.parse(a.target.responseText));
        b.dispatchEvent({ type: "load", content: a });
      },
      !1
    );
    c.addEventListener(
      "progress",
      function (a) {
        b.dispatchEvent({ type: "progress", loaded: a.loaded, total: a.total });
      },
      !1
    );
    c.addEventListener(
      "error",
      function () {
        b.dispatchEvent({
          type: "error",
          message: "Couldn't load URL [" + a + "]",
        });
      },
      !1
    );
    c.open("GET", a, !0);
    c.send(null);
  },
  parse: function () {},
};
THREE.MaterialLoader = function () {};
THREE.MaterialLoader.prototype = {
  constructor: THREE.MaterialLoader,
  addEventListener: THREE.EventDispatcher.prototype.addEventListener,
  hasEventListener: THREE.EventDispatcher.prototype.hasEventListener,
  removeEventListener: THREE.EventDispatcher.prototype.removeEventListener,
  dispatchEvent: THREE.EventDispatcher.prototype.dispatchEvent,
  load: function (a) {
    var b = this,
      c = new XMLHttpRequest();
    c.addEventListener(
      "load",
      function (a) {
        a = b.parse(JSON.parse(a.target.responseText));
        b.dispatchEvent({ type: "load", content: a });
      },
      !1
    );
    c.addEventListener(
      "progress",
      function (a) {
        b.dispatchEvent({ type: "progress", loaded: a.loaded, total: a.total });
      },
      !1
    );
    c.addEventListener(
      "error",
      function () {
        b.dispatchEvent({
          type: "error",
          message: "Couldn't load URL [" + a + "]",
        });
      },
      !1
    );
    c.open("GET", a, !0);
    c.send(null);
  },
  parse: function (a) {
    var b;
    switch (a.type) {
      case "MeshBasicMaterial":
        b = new THREE.MeshBasicMaterial({
          color: a.color,
          opacity: a.opacity,
          transparent: a.transparent,
          wireframe: a.wireframe,
        });
        break;
      case "MeshLambertMaterial":
        b = new THREE.MeshLambertMaterial({
          color: a.color,
          ambient: a.ambient,
          emissive: a.emissive,
          opacity: a.opacity,
          transparent: a.transparent,
          wireframe: a.wireframe,
        });
        break;
      case "MeshPhongMaterial":
        b = new THREE.MeshPhongMaterial({
          color: a.color,
          ambient: a.ambient,
          emissive: a.emissive,
          specular: a.specular,
          shininess: a.shininess,
          opacity: a.opacity,
          transparent: a.transparent,
          wireframe: a.wireframe,
        });
        break;
      case "MeshNormalMaterial":
        b = new THREE.MeshNormalMaterial({
          opacity: a.opacity,
          transparent: a.transparent,
          wireframe: a.wireframe,
        });
        break;
      case "MeshDepthMaterial":
        b = new THREE.MeshDepthMaterial({
          opacity: a.opacity,
          transparent: a.transparent,
          wireframe: a.wireframe,
        });
    }
    return b;
  },
};
THREE.SceneLoader = function () {
  this.onLoadStart = function () {};
  this.onLoadProgress = function () {};
  this.onLoadComplete = function () {};
  this.callbackSync = function () {};
  this.callbackProgress = function () {};
  this.geometryHandlerMap = {};
  this.hierarchyHandlerMap = {};
  this.addGeometryHandler("ascii", THREE.JSONLoader);
};
THREE.SceneLoader.prototype.constructor = THREE.SceneLoader;
THREE.SceneLoader.prototype.load = function (a, b) {
  var c = this,
    d = new XMLHttpRequest();
  d.onreadystatechange = function () {
    if (4 === d.readyState)
      if (200 === d.status || 0 === d.status) {
        var e = JSON.parse(d.responseText);
        c.parse(e, b, a);
      } else
        console.error(
          "THREE.SceneLoader: Couldn't load [" + a + "] [" + d.status + "]"
        );
  };
  d.open("GET", a, !0);
  d.send(null);
};
THREE.SceneLoader.prototype.addGeometryHandler = function (a, b) {
  this.geometryHandlerMap[a] = { loaderClass: b };
};
THREE.SceneLoader.prototype.addHierarchyHandler = function (a, b) {
  this.hierarchyHandlerMap[a] = { loaderClass: b };
};
THREE.SceneLoader.prototype.parse = function (a, b, c) {
  function d(a, b) {
    return "relativeToHTML" == b ? a : p + "/" + a;
  }
  function e() {
    f(z.scene, K.objects);
  }
  function f(a, b) {
    var c, e, g, i, j, p, n;
    for (n in b)
      if (void 0 === z.objects[n]) {
        var q = b[n],
          t = null;
        if (q.type && q.type in m.hierarchyHandlerMap) {
          if (void 0 === q.loading) {
            e = {
              type: 1,
              url: 1,
              material: 1,
              position: 1,
              rotation: 1,
              scale: 1,
              visible: 1,
              children: 1,
              userData: 1,
              skin: 1,
              morph: 1,
              mirroredLoop: 1,
              duration: 1,
            };
            g = {};
            for (var B in q) B in e || (g[B] = q[B]);
            r = z.materials[q.material];
            q.loading = !0;
            e = m.hierarchyHandlerMap[q.type].loaderObject;
            e.options
              ? e.load(d(q.url, K.urlBaseType), h(n, a, r, q))
              : e.load(d(q.url, K.urlBaseType), h(n, a, r, q), g);
          }
        } else if (void 0 !== q.geometry) {
          if ((l = z.geometries[q.geometry])) {
            t = !1;
            r = z.materials[q.material];
            t = r instanceof THREE.ShaderMaterial;
            g = q.position;
            i = q.rotation;
            j = q.scale;
            c = q.matrix;
            p = q.quaternion;
            q.material ||
              (r = new THREE.MeshFaceMaterial(z.face_materials[q.geometry]));
            r instanceof THREE.MeshFaceMaterial &&
              0 === r.materials.length &&
              (r = new THREE.MeshFaceMaterial(z.face_materials[q.geometry]));
            if (r instanceof THREE.MeshFaceMaterial)
              for (e = 0; e < r.materials.length; e++)
                t = t || r.materials[e] instanceof THREE.ShaderMaterial;
            t && l.computeTangents();
            q.skin
              ? (t = new THREE.SkinnedMesh(l, r))
              : q.morph
              ? ((t = new THREE.MorphAnimMesh(l, r)),
                void 0 !== q.duration && (t.duration = q.duration),
                void 0 !== q.time && (t.time = q.time),
                void 0 !== q.mirroredLoop && (t.mirroredLoop = q.mirroredLoop),
                r.morphNormals && l.computeMorphNormals())
              : (t = new THREE.Mesh(l, r));
            t.name = n;
            c
              ? ((t.matrixAutoUpdate = !1),
                t.matrix.set(
                  c[0],
                  c[1],
                  c[2],
                  c[3],
                  c[4],
                  c[5],
                  c[6],
                  c[7],
                  c[8],
                  c[9],
                  c[10],
                  c[11],
                  c[12],
                  c[13],
                  c[14],
                  c[15]
                ))
              : (t.position.set(g[0], g[1], g[2]),
                p
                  ? (t.quaternion.set(p[0], p[1], p[2], p[3]),
                    (t.useQuaternion = !0))
                  : t.rotation.set(i[0], i[1], i[2]),
                t.scale.set(j[0], j[1], j[2]));
            t.visible = q.visible;
            t.castShadow = q.castShadow;
            t.receiveShadow = q.receiveShadow;
            a.add(t);
            z.objects[n] = t;
          }
        } else
          "DirectionalLight" === q.type ||
          "PointLight" === q.type ||
          "AmbientLight" === q.type
            ? ((u = void 0 !== q.color ? q.color : 16777215),
              (x = void 0 !== q.intensity ? q.intensity : 1),
              "DirectionalLight" === q.type
                ? ((g = q.direction),
                  (y = new THREE.DirectionalLight(u, x)),
                  y.position.set(g[0], g[1], g[2]),
                  q.target &&
                    (H.push({ object: y, targetName: q.target }),
                    (y.target = null)))
                : "PointLight" === q.type
                ? ((g = q.position),
                  (e = q.distance),
                  (y = new THREE.PointLight(u, x, e)),
                  y.position.set(g[0], g[1], g[2]))
                : "AmbientLight" === q.type && (y = new THREE.AmbientLight(u)),
              a.add(y),
              (y.name = n),
              (z.lights[n] = y),
              (z.objects[n] = y))
            : "PerspectiveCamera" === q.type || "OrthographicCamera" === q.type
            ? ((g = q.position),
              (i = q.rotation),
              (p = q.quaternion),
              "PerspectiveCamera" === q.type
                ? (s = new THREE.PerspectiveCamera(
                    q.fov,
                    q.aspect,
                    q.near,
                    q.far
                  ))
                : "OrthographicCamera" === q.type &&
                  (s = new THREE.OrthographicCamera(
                    q.left,
                    q.right,
                    q.top,
                    q.bottom,
                    q.near,
                    q.far
                  )),
              (s.name = n),
              s.position.set(g[0], g[1], g[2]),
              void 0 !== p
                ? (s.quaternion.set(p[0], p[1], p[2], p[3]),
                  (s.useQuaternion = !0))
                : void 0 !== i && s.rotation.set(i[0], i[1], i[2]),
              a.add(s),
              (z.cameras[n] = s),
              (z.objects[n] = s))
            : ((g = q.position),
              (i = q.rotation),
              (j = q.scale),
              (p = q.quaternion),
              (t = new THREE.Object3D()),
              (t.name = n),
              t.position.set(g[0], g[1], g[2]),
              p
                ? (t.quaternion.set(p[0], p[1], p[2], p[3]),
                  (t.useQuaternion = !0))
                : t.rotation.set(i[0], i[1], i[2]),
              t.scale.set(j[0], j[1], j[2]),
              (t.visible = void 0 !== q.visible ? q.visible : !1),
              a.add(t),
              (z.objects[n] = t),
              (z.empties[n] = t));
        if (t) {
          if (void 0 !== q.userData)
            for (var E in q.userData) t.userData[E] = q.userData[E];
          if (void 0 !== q.groups)
            for (e = 0; e < q.groups.length; e++)
              (g = q.groups[e]),
                void 0 === z.groups[g] && (z.groups[g] = []),
                z.groups[g].push(n);
          void 0 !== q.children && f(t, q.children);
        }
      }
  }
  function g(a) {
    return function (b, c) {
      b.name = a;
      z.geometries[a] = b;
      z.face_materials[a] = c;
      e();
      t -= 1;
      m.onLoadComplete();
      j();
    };
  }
  function h(a, b, c, d) {
    return function (f) {
      var f = f.content ? f.content : f.dae ? f.scene : f,
        g = d.position,
        h = d.rotation,
        i = d.quaternion,
        l = d.scale;
      f.position.set(g[0], g[1], g[2]);
      i
        ? (f.quaternion.set(i[0], i[1], i[2], i[3]), (f.useQuaternion = !0))
        : f.rotation.set(h[0], h[1], h[2]);
      f.scale.set(l[0], l[1], l[2]);
      c &&
        f.traverse(function (a) {
          a.material = c;
        });
      var p = void 0 !== d.visible ? d.visible : !0;
      f.traverse(function (a) {
        a.visible = p;
      });
      b.add(f);
      f.name = a;
      z.objects[a] = f;
      e();
      t -= 1;
      m.onLoadComplete();
      j();
    };
  }
  function i(a) {
    return function (b, c) {
      b.name = a;
      z.geometries[a] = b;
      z.face_materials[a] = c;
    };
  }
  function j() {
    m.callbackProgress(
      {
        totalModels: J,
        totalTextures: F,
        loadedModels: J - t,
        loadedTextures: F - E,
      },
      z
    );
    m.onLoadProgress();
    if (0 === t && 0 === E) {
      for (var a = 0; a < H.length; a++) {
        var c = H[a],
          d = z.objects[c.targetName];
        d
          ? (c.object.target = d)
          : ((c.object.target = new THREE.Object3D()),
            z.scene.add(c.object.target));
        c.object.target.userData.targetInverse = c.object;
      }
      b(z);
    }
  }
  var m = this,
    p = THREE.Loader.prototype.extractUrlBase(c),
    l,
    r,
    s,
    n,
    q,
    y,
    u,
    x,
    t,
    E,
    J,
    F,
    z,
    H = [],
    K = a,
    G;
  for (G in this.geometryHandlerMap)
    (a = this.geometryHandlerMap[G].loaderClass),
      (this.geometryHandlerMap[G].loaderObject = new a());
  for (G in this.hierarchyHandlerMap)
    (a = this.hierarchyHandlerMap[G].loaderClass),
      (this.hierarchyHandlerMap[G].loaderObject = new a());
  E = t = 0;
  z = {
    scene: new THREE.Scene(),
    geometries: {},
    face_materials: {},
    materials: {},
    textures: {},
    objects: {},
    cameras: {},
    lights: {},
    fogs: {},
    empties: {},
    groups: {},
  };
  if (
    K.transform &&
    ((G = K.transform.position),
    (a = K.transform.rotation),
    (c = K.transform.scale),
    G && z.scene.position.set(G[0], G[1], G[2]),
    a && z.scene.rotation.set(a[0], a[1], a[2]),
    c && z.scene.scale.set(c[0], c[1], c[2]),
    G || a || c)
  )
    z.scene.updateMatrix(), z.scene.updateMatrixWorld();
  G = function (a) {
    return function () {
      E -= a;
      j();
      m.onLoadComplete();
    };
  };
  for (var L in K.fogs)
    (a = K.fogs[L]),
      "linear" === a.type
        ? (n = new THREE.Fog(0, a.near, a.far))
        : "exp2" === a.type && (n = new THREE.FogExp2(0, a.density)),
      (a = a.color),
      n.color.setRGB(a[0], a[1], a[2]),
      (z.fogs[L] = n);
  for (var B in K.geometries)
    (n = K.geometries[B]),
      n.type in this.geometryHandlerMap && ((t += 1), m.onLoadStart());
  for (var V in K.objects)
    (n = K.objects[V]),
      n.type &&
        n.type in this.hierarchyHandlerMap &&
        ((t += 1), m.onLoadStart());
  J = t;
  for (B in K.geometries)
    if (((n = K.geometries[B]), "cube" === n.type))
      (l = new THREE.CubeGeometry(
        n.width,
        n.height,
        n.depth,
        n.widthSegments,
        n.heightSegments,
        n.depthSegments
      )),
        (l.name = B),
        (z.geometries[B] = l);
    else if ("plane" === n.type)
      (l = new THREE.PlaneGeometry(
        n.width,
        n.height,
        n.widthSegments,
        n.heightSegments
      )),
        (l.name = B),
        (z.geometries[B] = l);
    else if ("sphere" === n.type)
      (l = new THREE.SphereGeometry(
        n.radius,
        n.widthSegments,
        n.heightSegments
      )),
        (l.name = B),
        (z.geometries[B] = l);
    else if ("cylinder" === n.type)
      (l = new THREE.CylinderGeometry(
        n.topRad,
        n.botRad,
        n.height,
        n.radSegs,
        n.heightSegs
      )),
        (l.name = B),
        (z.geometries[B] = l);
    else if ("torus" === n.type)
      (l = new THREE.TorusGeometry(n.radius, n.tube, n.segmentsR, n.segmentsT)),
        (l.name = B),
        (z.geometries[B] = l);
    else if ("icosahedron" === n.type)
      (l = new THREE.IcosahedronGeometry(n.radius, n.subdivisions)),
        (l.name = B),
        (z.geometries[B] = l);
    else if (n.type in this.geometryHandlerMap) {
      V = {};
      for (q in n) "type" !== q && "url" !== q && (V[q] = n[q]);
      this.geometryHandlerMap[n.type].loaderObject.load(
        d(n.url, K.urlBaseType),
        g(B),
        V
      );
    } else
      "embedded" === n.type &&
        ((V = K.embeds[n.id]),
        (V.metadata = K.metadata),
        V &&
          ((V = this.geometryHandlerMap.ascii.loaderObject.parse(V, "")),
          i(B)(V.geometry, V.materials)));
  for (var C in K.textures)
    if (((B = K.textures[C]), B.url instanceof Array)) {
      E += B.url.length;
      for (q = 0; q < B.url.length; q++) m.onLoadStart();
    } else (E += 1), m.onLoadStart();
  F = E;
  for (C in K.textures) {
    B = K.textures[C];
    void 0 !== B.mapping &&
      void 0 !== THREE[B.mapping] &&
      (B.mapping = new THREE[B.mapping]());
    if (B.url instanceof Array) {
      V = B.url.length;
      n = [];
      for (q = 0; q < V; q++) n[q] = d(B.url[q], K.urlBaseType);
      q = (q = /\.dds$/i.test(n[0]))
        ? THREE.ImageUtils.loadCompressedTextureCube(n, B.mapping, G(V))
        : THREE.ImageUtils.loadTextureCube(n, B.mapping, G(V));
    } else
      (q = /\.dds$/i.test(B.url)),
        (V = d(B.url, K.urlBaseType)),
        (n = G(1)),
        (q = q
          ? THREE.ImageUtils.loadCompressedTexture(V, B.mapping, n)
          : THREE.ImageUtils.loadTexture(V, B.mapping, n)),
        void 0 !== THREE[B.minFilter] && (q.minFilter = THREE[B.minFilter]),
        void 0 !== THREE[B.magFilter] && (q.magFilter = THREE[B.magFilter]),
        B.anisotropy && (q.anisotropy = B.anisotropy),
        B.repeat &&
          (q.repeat.set(B.repeat[0], B.repeat[1]),
          1 !== B.repeat[0] && (q.wrapS = THREE.RepeatWrapping),
          1 !== B.repeat[1] && (q.wrapT = THREE.RepeatWrapping)),
        B.offset && q.offset.set(B.offset[0], B.offset[1]),
        B.wrap &&
          ((V = {
            repeat: THREE.RepeatWrapping,
            mirror: THREE.MirroredRepeatWrapping,
          }),
          void 0 !== V[B.wrap[0]] && (q.wrapS = V[B.wrap[0]]),
          void 0 !== V[B.wrap[1]] && (q.wrapT = V[B.wrap[1]]));
    z.textures[C] = q;
  }
  var I, M;
  for (I in K.materials) {
    C = K.materials[I];
    for (M in C.parameters)
      "envMap" === M || "map" === M || "lightMap" === M || "bumpMap" === M
        ? (C.parameters[M] = z.textures[C.parameters[M]])
        : "shading" === M
        ? (C.parameters[M] =
            "flat" === C.parameters[M]
              ? THREE.FlatShading
              : THREE.SmoothShading)
        : "side" === M
        ? (C.parameters[M] =
            "double" == C.parameters[M]
              ? THREE.DoubleSide
              : "back" == C.parameters[M]
              ? THREE.BackSide
              : THREE.FrontSide)
        : "blending" === M
        ? (C.parameters[M] =
            C.parameters[M] in THREE
              ? THREE[C.parameters[M]]
              : THREE.NormalBlending)
        : "combine" === M
        ? (C.parameters[M] =
            C.parameters[M] in THREE
              ? THREE[C.parameters[M]]
              : THREE.MultiplyOperation)
        : "vertexColors" === M
        ? "face" == C.parameters[M]
          ? (C.parameters[M] = THREE.FaceColors)
          : C.parameters[M] && (C.parameters[M] = THREE.VertexColors)
        : "wrapRGB" === M &&
          ((G = C.parameters[M]),
          (C.parameters[M] = new THREE.Vector3(G[0], G[1], G[2])));
    void 0 !== C.parameters.opacity &&
      1 > C.parameters.opacity &&
      (C.parameters.transparent = !0);
    C.parameters.normalMap
      ? ((G = THREE.ShaderLib.normalmap),
        (B = THREE.UniformsUtils.clone(G.uniforms)),
        (q = C.parameters.color),
        (V = C.parameters.specular),
        (n = C.parameters.ambient),
        (L = C.parameters.shininess),
        (B.tNormal.value = z.textures[C.parameters.normalMap]),
        C.parameters.normalScale &&
          B.uNormalScale.value.set(
            C.parameters.normalScale[0],
            C.parameters.normalScale[1]
          ),
        C.parameters.map &&
          ((B.tDiffuse.value = C.parameters.map), (B.enableDiffuse.value = !0)),
        C.parameters.envMap &&
          ((B.tCube.value = C.parameters.envMap),
          (B.enableReflection.value = !0),
          (B.uReflectivity.value = C.parameters.reflectivity)),
        C.parameters.lightMap &&
          ((B.tAO.value = C.parameters.lightMap), (B.enableAO.value = !0)),
        C.parameters.specularMap &&
          ((B.tSpecular.value = z.textures[C.parameters.specularMap]),
          (B.enableSpecular.value = !0)),
        C.parameters.displacementMap &&
          ((B.tDisplacement.value = z.textures[C.parameters.displacementMap]),
          (B.enableDisplacement.value = !0),
          (B.uDisplacementBias.value = C.parameters.displacementBias),
          (B.uDisplacementScale.value = C.parameters.displacementScale)),
        B.uDiffuseColor.value.setHex(q),
        B.uSpecularColor.value.setHex(V),
        B.uAmbientColor.value.setHex(n),
        (B.uShininess.value = L),
        C.parameters.opacity && (B.uOpacity.value = C.parameters.opacity),
        (r = new THREE.ShaderMaterial({
          fragmentShader: G.fragmentShader,
          vertexShader: G.vertexShader,
          uniforms: B,
          lights: !0,
          fog: !0,
        })))
      : (r = new THREE[C.type](C.parameters));
    r.name = I;
    z.materials[I] = r;
  }
  for (I in K.materials)
    if (((C = K.materials[I]), C.parameters.materials)) {
      M = [];
      for (q = 0; q < C.parameters.materials.length; q++)
        M.push(z.materials[C.parameters.materials[q]]);
      z.materials[I].materials = M;
    }
  e();
  z.cameras &&
    K.defaults.camera &&
    (z.currentCamera = z.cameras[K.defaults.camera]);
  z.fogs && K.defaults.fog && (z.scene.fog = z.fogs[K.defaults.fog]);
  m.callbackSync(z);
  j();
};
THREE.TextureLoader = function () {
  this.crossOrigin = null;
};
THREE.TextureLoader.prototype = {
  constructor: THREE.TextureLoader,
  addEventListener: THREE.EventDispatcher.prototype.addEventListener,
  hasEventListener: THREE.EventDispatcher.prototype.hasEventListener,
  removeEventListener: THREE.EventDispatcher.prototype.removeEventListener,
  dispatchEvent: THREE.EventDispatcher.prototype.dispatchEvent,
  load: function (a) {
    var b = this,
      c = new Image();
    c.addEventListener(
      "load",
      function () {
        var a = new THREE.Texture(c);
        a.needsUpdate = !0;
        b.dispatchEvent({ type: "load", content: a });
      },
      !1
    );
    c.addEventListener(
      "error",
      function () {
        b.dispatchEvent({
          type: "error",
          message: "Couldn't load URL [" + a + "]",
        });
      },
      !1
    );
    b.crossOrigin && (c.crossOrigin = b.crossOrigin);
    c.src = a;
  },
};
THREE.Material = function () {
  this.id = THREE.MaterialIdCount++;
  this.name = "";
  this.side = THREE.FrontSide;
  this.opacity = 1;
  this.transparent = !1;
  this.blending = THREE.NormalBlending;
  this.blendSrc = THREE.SrcAlphaFactor;
  this.blendDst = THREE.OneMinusSrcAlphaFactor;
  this.blendEquation = THREE.AddEquation;
  this.depthWrite = this.depthTest = !0;
  this.polygonOffset = !1;
  this.alphaTest = this.polygonOffsetUnits = this.polygonOffsetFactor = 0;
  this.overdraw = !1;
  this.needsUpdate = this.visible = !0;
};
THREE.Material.prototype = {
  constructor: THREE.Material,
  addEventListener: THREE.EventDispatcher.prototype.addEventListener,
  hasEventListener: THREE.EventDispatcher.prototype.hasEventListener,
  removeEventListener: THREE.EventDispatcher.prototype.removeEventListener,
  dispatchEvent: THREE.EventDispatcher.prototype.dispatchEvent,
  setValues: function (a) {
    if (void 0 !== a)
      for (var b in a) {
        var c = a[b];
        if (void 0 === c)
          console.warn("THREE.Material: '" + b + "' parameter is undefined.");
        else if (b in this) {
          var d = this[b];
          d instanceof THREE.Color
            ? d.set(c)
            : d instanceof THREE.Vector3 && c instanceof THREE.Vector3
            ? d.copy(c)
            : (this[b] = c);
        }
      }
  },
  clone: function (a) {
    void 0 === a && (a = new THREE.Material());
    a.name = this.name;
    a.side = this.side;
    a.opacity = this.opacity;
    a.transparent = this.transparent;
    a.blending = this.blending;
    a.blendSrc = this.blendSrc;
    a.blendDst = this.blendDst;
    a.blendEquation = this.blendEquation;
    a.depthTest = this.depthTest;
    a.depthWrite = this.depthWrite;
    a.polygonOffset = this.polygonOffset;
    a.polygonOffsetFactor = this.polygonOffsetFactor;
    a.polygonOffsetUnits = this.polygonOffsetUnits;
    a.alphaTest = this.alphaTest;
    a.overdraw = this.overdraw;
    a.visible = this.visible;
    return a;
  },
  dispose: function () {
    this.dispatchEvent({ type: "dispose" });
  },
};
THREE.MaterialIdCount = 0;
THREE.LineBasicMaterial = function (a) {
  THREE.Material.call(this);
  this.color = new THREE.Color(16777215);
  this.linewidth = 1;
  this.linejoin = this.linecap = "round";
  this.vertexColors = !1;
  this.fog = !0;
  this.setValues(a);
};
THREE.LineBasicMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.LineBasicMaterial.prototype.clone = function () {
  var a = new THREE.LineBasicMaterial();
  THREE.Material.prototype.clone.call(this, a);
  a.color.copy(this.color);
  a.linewidth = this.linewidth;
  a.linecap = this.linecap;
  a.linejoin = this.linejoin;
  a.vertexColors = this.vertexColors;
  a.fog = this.fog;
  return a;
};
THREE.LineDashedMaterial = function (a) {
  THREE.Material.call(this);
  this.color = new THREE.Color(16777215);
  this.scale = this.linewidth = 1;
  this.dashSize = 3;
  this.gapSize = 1;
  this.vertexColors = !1;
  this.fog = !0;
  this.setValues(a);
};
THREE.LineDashedMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.LineDashedMaterial.prototype.clone = function () {
  var a = new THREE.LineDashedMaterial();
  THREE.Material.prototype.clone.call(this, a);
  a.color.copy(this.color);
  a.linewidth = this.linewidth;
  a.scale = this.scale;
  a.dashSize = this.dashSize;
  a.gapSize = this.gapSize;
  a.vertexColors = this.vertexColors;
  a.fog = this.fog;
  return a;
};
THREE.MeshBasicMaterial = function (a) {
  THREE.Material.call(this);
  this.color = new THREE.Color(16777215);
  this.envMap = this.specularMap = this.lightMap = this.map = null;
  this.combine = THREE.MultiplyOperation;
  this.reflectivity = 1;
  this.refractionRatio = 0.98;
  this.fog = !0;
  this.shading = THREE.SmoothShading;
  this.wireframe = !1;
  this.wireframeLinewidth = 1;
  this.wireframeLinejoin = this.wireframeLinecap = "round";
  this.vertexColors = THREE.NoColors;
  this.morphTargets = this.skinning = !1;
  this.setValues(a);
};
THREE.MeshBasicMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.MeshBasicMaterial.prototype.clone = function () {
  var a = new THREE.MeshBasicMaterial();
  THREE.Material.prototype.clone.call(this, a);
  a.color.copy(this.color);
  a.map = this.map;
  a.lightMap = this.lightMap;
  a.specularMap = this.specularMap;
  a.envMap = this.envMap;
  a.combine = this.combine;
  a.reflectivity = this.reflectivity;
  a.refractionRatio = this.refractionRatio;
  a.fog = this.fog;
  a.shading = this.shading;
  a.wireframe = this.wireframe;
  a.wireframeLinewidth = this.wireframeLinewidth;
  a.wireframeLinecap = this.wireframeLinecap;
  a.wireframeLinejoin = this.wireframeLinejoin;
  a.vertexColors = this.vertexColors;
  a.skinning = this.skinning;
  a.morphTargets = this.morphTargets;
  return a;
};
THREE.MeshLambertMaterial = function (a) {
  THREE.Material.call(this);
  this.color = new THREE.Color(16777215);
  this.ambient = new THREE.Color(16777215);
  this.emissive = new THREE.Color(0);
  this.wrapAround = !1;
  this.wrapRGB = new THREE.Vector3(1, 1, 1);
  this.envMap = this.specularMap = this.lightMap = this.map = null;
  this.combine = THREE.MultiplyOperation;
  this.reflectivity = 1;
  this.refractionRatio = 0.98;
  this.fog = !0;
  this.shading = THREE.SmoothShading;
  this.wireframe = !1;
  this.wireframeLinewidth = 1;
  this.wireframeLinejoin = this.wireframeLinecap = "round";
  this.vertexColors = THREE.NoColors;
  this.morphNormals = this.morphTargets = this.skinning = !1;
  this.setValues(a);
};
THREE.MeshLambertMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.MeshLambertMaterial.prototype.clone = function () {
  var a = new THREE.MeshLambertMaterial();
  THREE.Material.prototype.clone.call(this, a);
  a.color.copy(this.color);
  a.ambient.copy(this.ambient);
  a.emissive.copy(this.emissive);
  a.wrapAround = this.wrapAround;
  a.wrapRGB.copy(this.wrapRGB);
  a.map = this.map;
  a.lightMap = this.lightMap;
  a.specularMap = this.specularMap;
  a.envMap = this.envMap;
  a.combine = this.combine;
  a.reflectivity = this.reflectivity;
  a.refractionRatio = this.refractionRatio;
  a.fog = this.fog;
  a.shading = this.shading;
  a.wireframe = this.wireframe;
  a.wireframeLinewidth = this.wireframeLinewidth;
  a.wireframeLinecap = this.wireframeLinecap;
  a.wireframeLinejoin = this.wireframeLinejoin;
  a.vertexColors = this.vertexColors;
  a.skinning = this.skinning;
  a.morphTargets = this.morphTargets;
  a.morphNormals = this.morphNormals;
  return a;
};
THREE.MeshPhongMaterial = function (a) {
  THREE.Material.call(this);
  this.color = new THREE.Color(16777215);
  this.ambient = new THREE.Color(16777215);
  this.emissive = new THREE.Color(0);
  this.specular = new THREE.Color(1118481);
  this.shininess = 30;
  this.metal = !1;
  this.perPixel = !0;
  this.wrapAround = !1;
  this.wrapRGB = new THREE.Vector3(1, 1, 1);
  this.bumpMap = this.lightMap = this.map = null;
  this.bumpScale = 1;
  this.normalMap = null;
  this.normalScale = new THREE.Vector2(1, 1);
  this.envMap = this.specularMap = null;
  this.combine = THREE.MultiplyOperation;
  this.reflectivity = 1;
  this.refractionRatio = 0.98;
  this.fog = !0;
  this.shading = THREE.SmoothShading;
  this.wireframe = !1;
  this.wireframeLinewidth = 1;
  this.wireframeLinejoin = this.wireframeLinecap = "round";
  this.vertexColors = THREE.NoColors;
  this.morphNormals = this.morphTargets = this.skinning = !1;
  this.setValues(a);
};
THREE.MeshPhongMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.MeshPhongMaterial.prototype.clone = function () {
  var a = new THREE.MeshPhongMaterial();
  THREE.Material.prototype.clone.call(this, a);
  a.color.copy(this.color);
  a.ambient.copy(this.ambient);
  a.emissive.copy(this.emissive);
  a.specular.copy(this.specular);
  a.shininess = this.shininess;
  a.metal = this.metal;
  a.perPixel = this.perPixel;
  a.wrapAround = this.wrapAround;
  a.wrapRGB.copy(this.wrapRGB);
  a.map = this.map;
  a.lightMap = this.lightMap;
  a.bumpMap = this.bumpMap;
  a.bumpScale = this.bumpScale;
  a.normalMap = this.normalMap;
  a.normalScale.copy(this.normalScale);
  a.specularMap = this.specularMap;
  a.envMap = this.envMap;
  a.combine = this.combine;
  a.reflectivity = this.reflectivity;
  a.refractionRatio = this.refractionRatio;
  a.fog = this.fog;
  a.shading = this.shading;
  a.wireframe = this.wireframe;
  a.wireframeLinewidth = this.wireframeLinewidth;
  a.wireframeLinecap = this.wireframeLinecap;
  a.wireframeLinejoin = this.wireframeLinejoin;
  a.vertexColors = this.vertexColors;
  a.skinning = this.skinning;
  a.morphTargets = this.morphTargets;
  a.morphNormals = this.morphNormals;
  return a;
};
THREE.MeshDepthMaterial = function (a) {
  THREE.Material.call(this);
  this.wireframe = !1;
  this.wireframeLinewidth = 1;
  this.setValues(a);
};
THREE.MeshDepthMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.MeshDepthMaterial.prototype.clone = function () {
  var a = new THREE.MeshDepthMaterial();
  THREE.Material.prototype.clone.call(this, a);
  a.wireframe = this.wireframe;
  a.wireframeLinewidth = this.wireframeLinewidth;
  return a;
};
THREE.MeshNormalMaterial = function (a) {
  THREE.Material.call(this, a);
  this.shading = THREE.FlatShading;
  this.wireframe = !1;
  this.wireframeLinewidth = 1;
  this.morphTargets = !1;
  this.setValues(a);
};
THREE.MeshNormalMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.MeshNormalMaterial.prototype.clone = function () {
  var a = new THREE.MeshNormalMaterial();
  THREE.Material.prototype.clone.call(this, a);
  a.shading = this.shading;
  a.wireframe = this.wireframe;
  a.wireframeLinewidth = this.wireframeLinewidth;
  return a;
};
THREE.MeshFaceMaterial = function (a) {
  this.materials = a instanceof Array ? a : [];
};
THREE.MeshFaceMaterial.prototype.clone = function () {
  return new THREE.MeshFaceMaterial(this.materials.slice(0));
};
THREE.ParticleBasicMaterial = function (a) {
  THREE.Material.call(this);
  this.color = new THREE.Color(16777215);
  this.map = null;
  this.size = 1;
  this.sizeAttenuation = !0;
  this.vertexColors = !1;
  this.fog = !0;
  this.setValues(a);
};
THREE.ParticleBasicMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.ParticleBasicMaterial.prototype.clone = function () {
  var a = new THREE.ParticleBasicMaterial();
  THREE.Material.prototype.clone.call(this, a);
  a.color.copy(this.color);
  a.map = this.map;
  a.size = this.size;
  a.sizeAttenuation = this.sizeAttenuation;
  a.vertexColors = this.vertexColors;
  a.fog = this.fog;
  return a;
};
THREE.ParticleCanvasMaterial = function (a) {
  THREE.Material.call(this);
  this.color = new THREE.Color(16777215);
  this.program = function () {};
  this.setValues(a);
};
THREE.ParticleCanvasMaterial.prototype = Object.create(
  THREE.Material.prototype
);
THREE.ParticleCanvasMaterial.prototype.clone = function () {
  var a = new THREE.ParticleCanvasMaterial();
  THREE.Material.prototype.clone.call(this, a);
  a.color.copy(this.color);
  a.program = this.program;
  return a;
};
THREE.ShaderMaterial = function (a) {
  THREE.Material.call(this);
  this.vertexShader = this.fragmentShader = "void main() {}";
  this.uniforms = {};
  this.defines = {};
  this.attributes = null;
  this.shading = THREE.SmoothShading;
  this.linewidth = 1;
  this.wireframe = !1;
  this.wireframeLinewidth = 1;
  this.lights = this.fog = !1;
  this.vertexColors = THREE.NoColors;
  this.morphNormals = this.morphTargets = this.skinning = !1;
  this.setValues(a);
};
THREE.ShaderMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.ShaderMaterial.prototype.clone = function () {
  var a = new THREE.ShaderMaterial();
  THREE.Material.prototype.clone.call(this, a);
  a.fragmentShader = this.fragmentShader;
  a.vertexShader = this.vertexShader;
  a.uniforms = THREE.UniformsUtils.clone(this.uniforms);
  a.attributes = this.attributes;
  a.defines = this.defines;
  a.shading = this.shading;
  a.wireframe = this.wireframe;
  a.wireframeLinewidth = this.wireframeLinewidth;
  a.fog = this.fog;
  a.lights = this.lights;
  a.vertexColors = this.vertexColors;
  a.skinning = this.skinning;
  a.morphTargets = this.morphTargets;
  a.morphNormals = this.morphNormals;
  return a;
};
THREE.SpriteMaterial = function (a) {
  THREE.Material.call(this);
  this.color = new THREE.Color(16777215);
  this.map = new THREE.Texture();
  this.useScreenCoordinates = !0;
  this.depthTest = !this.useScreenCoordinates;
  this.sizeAttenuation = !this.useScreenCoordinates;
  this.scaleByViewport = !this.sizeAttenuation;
  this.alignment = THREE.SpriteAlignment.center.clone();
  this.fog = !1;
  this.uvOffset = new THREE.Vector2(0, 0);
  this.uvScale = new THREE.Vector2(1, 1);
  this.setValues(a);
  a = a || {};
  void 0 === a.depthTest && (this.depthTest = !this.useScreenCoordinates);
  void 0 === a.sizeAttenuation &&
    (this.sizeAttenuation = !this.useScreenCoordinates);
  void 0 === a.scaleByViewport &&
    (this.scaleByViewport = !this.sizeAttenuation);
};
THREE.SpriteMaterial.prototype = Object.create(THREE.Material.prototype);
THREE.SpriteMaterial.prototype.clone = function () {
  var a = new THREE.SpriteMaterial();
  THREE.Material.prototype.clone.call(this, a);
  a.color.copy(this.color);
  a.map = this.map;
  a.useScreenCoordinates = this.useScreenCoordinates;
  a.sizeAttenuation = this.sizeAttenuation;
  a.scaleByViewport = this.scaleByViewport;
  a.alignment.copy(this.alignment);
  a.uvOffset.copy(this.uvOffset);
  a.uvScale.copy(this.uvScale);
  a.fog = this.fog;
  return a;
};
THREE.SpriteAlignment = {};
THREE.SpriteAlignment.topLeft = new THREE.Vector2(1, -1);
THREE.SpriteAlignment.topCenter = new THREE.Vector2(0, -1);
THREE.SpriteAlignment.topRight = new THREE.Vector2(-1, -1);
THREE.SpriteAlignment.centerLeft = new THREE.Vector2(1, 0);
THREE.SpriteAlignment.center = new THREE.Vector2(0, 0);
THREE.SpriteAlignment.centerRight = new THREE.Vector2(-1, 0);
THREE.SpriteAlignment.bottomLeft = new THREE.Vector2(1, 1);
THREE.SpriteAlignment.bottomCenter = new THREE.Vector2(0, 1);
THREE.SpriteAlignment.bottomRight = new THREE.Vector2(-1, 1);
THREE.Texture = function (a, b, c, d, e, f, g, h, i) {
  this.id = THREE.TextureIdCount++;
  this.name = "";
  this.image = a;
  this.mipmaps = [];
  this.mapping = void 0 !== b ? b : new THREE.UVMapping();
  this.wrapS = void 0 !== c ? c : THREE.ClampToEdgeWrapping;
  this.wrapT = void 0 !== d ? d : THREE.ClampToEdgeWrapping;
  this.magFilter = void 0 !== e ? e : THREE.LinearFilter;
  this.minFilter = void 0 !== f ? f : THREE.LinearMipMapLinearFilter;
  this.anisotropy = void 0 !== i ? i : 1;
  this.format = void 0 !== g ? g : THREE.RGBAFormat;
  this.type = void 0 !== h ? h : THREE.UnsignedByteType;
  this.offset = new THREE.Vector2(0, 0);
  this.repeat = new THREE.Vector2(1, 1);
  this.generateMipmaps = !0;
  this.premultiplyAlpha = !1;
  this.flipY = !0;
  this.unpackAlignment = 4;
  this.needsUpdate = !1;
  this.onUpdate = null;
};
THREE.Texture.prototype = {
  constructor: THREE.Texture,
  addEventListener: THREE.EventDispatcher.prototype.addEventListener,
  hasEventListener: THREE.EventDispatcher.prototype.hasEventListener,
  removeEventListener: THREE.EventDispatcher.prototype.removeEventListener,
  dispatchEvent: THREE.EventDispatcher.prototype.dispatchEvent,
  clone: function (a) {
    void 0 === a && (a = new THREE.Texture());
    a.image = this.image;
    a.mipmaps = this.mipmaps.slice(0);
    a.mapping = this.mapping;
    a.wrapS = this.wrapS;
    a.wrapT = this.wrapT;
    a.magFilter = this.magFilter;
    a.minFilter = this.minFilter;
    a.anisotropy = this.anisotropy;
    a.format = this.format;
    a.type = this.type;
    a.offset.copy(this.offset);
    a.repeat.copy(this.repeat);
    a.generateMipmaps = this.generateMipmaps;
    a.premultiplyAlpha = this.premultiplyAlpha;
    a.flipY = this.flipY;
    a.unpackAlignment = this.unpackAlignment;
    return a;
  },
  dispose: function () {
    this.dispatchEvent({ type: "dispose" });
  },
};
THREE.TextureIdCount = 0;
THREE.CompressedTexture = function (a, b, c, d, e, f, g, h, i, j, m) {
  THREE.Texture.call(this, null, f, g, h, i, j, d, e, m);
  this.image = { width: b, height: c };
  this.mipmaps = a;
  this.generateMipmaps = !1;
};
THREE.CompressedTexture.prototype = Object.create(THREE.Texture.prototype);
THREE.CompressedTexture.prototype.clone = function () {
  var a = new THREE.CompressedTexture();
  THREE.Texture.prototype.clone.call(this, a);
  return a;
};
THREE.DataTexture = function (a, b, c, d, e, f, g, h, i, j, m) {
  THREE.Texture.call(this, null, f, g, h, i, j, d, e, m);
  this.image = { data: a, width: b, height: c };
};
THREE.DataTexture.prototype = Object.create(THREE.Texture.prototype);
THREE.DataTexture.prototype.clone = function () {
  var a = new THREE.DataTexture();
  THREE.Texture.prototype.clone.call(this, a);
  return a;
};
THREE.Particle = function (a) {
  THREE.Object3D.call(this);
  this.material = a;
};
THREE.Particle.prototype = Object.create(THREE.Object3D.prototype);
THREE.Particle.prototype.clone = function (a) {
  void 0 === a && (a = new THREE.Particle(this.material));
  THREE.Object3D.prototype.clone.call(this, a);
  return a;
};
THREE.ParticleSystem = function (a, b) {
  THREE.Object3D.call(this);
  this.geometry = a;
  this.material =
    void 0 !== b
      ? b
      : new THREE.ParticleBasicMaterial({ color: 16777215 * Math.random() });
  this.sortParticles = !1;
  this.geometry &&
    null === this.geometry.boundingSphere &&
    this.geometry.computeBoundingSphere();
  this.frustumCulled = !1;
};
THREE.ParticleSystem.prototype = Object.create(THREE.Object3D.prototype);
THREE.ParticleSystem.prototype.clone = function (a) {
  void 0 === a && (a = new THREE.ParticleSystem(this.geometry, this.material));
  a.sortParticles = this.sortParticles;
  THREE.Object3D.prototype.clone.call(this, a);
  return a;
};
THREE.Line = function (a, b, c) {
  THREE.Object3D.call(this);
  this.geometry = a;
  this.material =
    void 0 !== b
      ? b
      : new THREE.LineBasicMaterial({ color: 16777215 * Math.random() });
  this.type = void 0 !== c ? c : THREE.LineStrip;
  this.geometry &&
    (this.geometry.boundingSphere || this.geometry.computeBoundingSphere());
};
THREE.LineStrip = 0;
THREE.LinePieces = 1;
THREE.Line.prototype = Object.create(THREE.Object3D.prototype);
THREE.Line.prototype.clone = function (a) {
  void 0 === a && (a = new THREE.Line(this.geometry, this.material, this.type));
  THREE.Object3D.prototype.clone.call(this, a);
  return a;
};
THREE.Mesh = function (a, b) {
  THREE.Object3D.call(this);
  this.material = this.geometry = null;
  this.setGeometry(a);
  this.setMaterial(b);
};
THREE.Mesh.prototype = Object.create(THREE.Object3D.prototype);
THREE.Mesh.prototype.setGeometry = function (a) {
  void 0 !== a &&
    ((this.geometry = a),
    null === this.geometry.boundingSphere &&
      this.geometry.computeBoundingSphere(),
    this.updateMorphTargets());
};
THREE.Mesh.prototype.setMaterial = function (a) {
  this.material =
    void 0 !== a
      ? a
      : new THREE.MeshBasicMaterial({
          color: 16777215 * Math.random(),
          wireframe: !0,
        });
};
THREE.Mesh.prototype.updateMorphTargets = function () {
  if (0 < this.geometry.morphTargets.length) {
    this.morphTargetBase = -1;
    this.morphTargetForcedOrder = [];
    this.morphTargetInfluences = [];
    this.morphTargetDictionary = {};
    for (var a = 0, b = this.geometry.morphTargets.length; a < b; a++)
      this.morphTargetInfluences.push(0),
        (this.morphTargetDictionary[this.geometry.morphTargets[a].name] = a);
  }
};
THREE.Mesh.prototype.getMorphTargetIndexByName = function (a) {
  if (void 0 !== this.morphTargetDictionary[a])
    return this.morphTargetDictionary[a];
  console.log(
    "THREE.Mesh.getMorphTargetIndexByName: morph target " +
      a +
      " does not exist. Returning 0."
  );
  return 0;
};
THREE.Mesh.prototype.clone = function (a) {
  void 0 === a && (a = new THREE.Mesh(this.geometry, this.material));
  THREE.Object3D.prototype.clone.call(this, a);
  return a;
};
THREE.Bone = function (a) {
  THREE.Object3D.call(this);
  this.skin = a;
  this.skinMatrix = new THREE.Matrix4();
};
THREE.Bone.prototype = Object.create(THREE.Object3D.prototype);
THREE.Bone.prototype.update = function (a, b) {
  this.matrixAutoUpdate && (b |= this.updateMatrix());
  if (b || this.matrixWorldNeedsUpdate)
    a
      ? this.skinMatrix.multiplyMatrices(a, this.matrix)
      : this.skinMatrix.copy(this.matrix),
      (this.matrixWorldNeedsUpdate = !1),
      (b = !0);
  var c,
    d = this.children.length;
  for (c = 0; c < d; c++) this.children[c].update(this.skinMatrix, b);
};
THREE.SkinnedMesh = function (a, b, c) {
  THREE.Mesh.call(this, a, b);
  this.useVertexTexture = void 0 !== c ? c : !0;
  this.identityMatrix = new THREE.Matrix4();
  this.bones = [];
  this.boneMatrices = [];
  var d, e, f;
  if (this.geometry && void 0 !== this.geometry.bones) {
    for (a = 0; a < this.geometry.bones.length; a++)
      (c = this.geometry.bones[a]),
        (d = c.pos),
        (e = c.rotq),
        (f = c.scl),
        (b = this.addBone()),
        (b.name = c.name),
        b.position.set(d[0], d[1], d[2]),
        b.quaternion.set(e[0], e[1], e[2], e[3]),
        (b.useQuaternion = !0),
        void 0 !== f ? b.scale.set(f[0], f[1], f[2]) : b.scale.set(1, 1, 1);
    for (a = 0; a < this.bones.length; a++)
      (c = this.geometry.bones[a]),
        (b = this.bones[a]),
        -1 === c.parent ? this.add(b) : this.bones[c.parent].add(b);
    a = this.bones.length;
    this.useVertexTexture
      ? ((this.boneTextureHeight =
          this.boneTextureWidth =
          a =
            256 < a ? 64 : 64 < a ? 32 : 16 < a ? 16 : 8),
        (this.boneMatrices = new Float32Array(
          4 * this.boneTextureWidth * this.boneTextureHeight
        )),
        (this.boneTexture = new THREE.DataTexture(
          this.boneMatrices,
          this.boneTextureWidth,
          this.boneTextureHeight,
          THREE.RGBAFormat,
          THREE.FloatType
        )),
        (this.boneTexture.minFilter = THREE.NearestFilter),
        (this.boneTexture.magFilter = THREE.NearestFilter),
        (this.boneTexture.generateMipmaps = !1),
        (this.boneTexture.flipY = !1))
      : (this.boneMatrices = new Float32Array(16 * a));
    this.pose();
  }
};
THREE.SkinnedMesh.prototype = Object.create(THREE.Mesh.prototype);
THREE.SkinnedMesh.prototype.addBone = function (a) {
  void 0 === a && (a = new THREE.Bone(this));
  this.bones.push(a);
  return a;
};
THREE.SkinnedMesh.prototype.updateMatrixWorld = function (a) {
  this.matrixAutoUpdate && this.updateMatrix();
  if (this.matrixWorldNeedsUpdate || a)
    this.parent
      ? this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix)
      : this.matrixWorld.copy(this.matrix),
      (this.matrixWorldNeedsUpdate = !1);
  for (var a = 0, b = this.children.length; a < b; a++) {
    var c = this.children[a];
    c instanceof THREE.Bone
      ? c.update(this.identityMatrix, !1)
      : c.updateMatrixWorld(!0);
  }
  if (void 0 == this.boneInverses) {
    this.boneInverses = [];
    a = 0;
    for (b = this.bones.length; a < b; a++)
      (c = new THREE.Matrix4()),
        c.getInverse(this.bones[a].skinMatrix),
        this.boneInverses.push(c);
  }
  a = 0;
  for (b = this.bones.length; a < b; a++)
    THREE.SkinnedMesh.offsetMatrix.multiplyMatrices(
      this.bones[a].skinMatrix,
      this.boneInverses[a]
    ),
      THREE.SkinnedMesh.offsetMatrix.flattenToArrayOffset(
        this.boneMatrices,
        16 * a
      );
  this.useVertexTexture && (this.boneTexture.needsUpdate = !0);
};
THREE.SkinnedMesh.prototype.pose = function () {
  this.updateMatrixWorld(!0);
  for (var a = 0; a < this.geometry.skinIndices.length; a++) {
    var b = this.geometry.skinWeights[a],
      c = 1 / b.lengthManhattan();
    Infinity !== c ? b.multiplyScalar(c) : b.set(1);
  }
};
THREE.SkinnedMesh.prototype.clone = function (a) {
  void 0 === a &&
    (a = new THREE.SkinnedMesh(
      this.geometry,
      this.material,
      this.useVertexTexture
    ));
  THREE.Mesh.prototype.clone.call(this, a);
  return a;
};
THREE.SkinnedMesh.offsetMatrix = new THREE.Matrix4();
THREE.MorphAnimMesh = function (a, b) {
  THREE.Mesh.call(this, a, b);
  this.duration = 1e3;
  this.mirroredLoop = !1;
  this.currentKeyframe = this.lastKeyframe = this.time = 0;
  this.direction = 1;
  this.directionBackwards = !1;
  this.setFrameRange(0, this.geometry.morphTargets.length - 1);
};
THREE.MorphAnimMesh.prototype = Object.create(THREE.Mesh.prototype);
THREE.MorphAnimMesh.prototype.setFrameRange = function (a, b) {
  this.startKeyframe = a;
  this.endKeyframe = b;
  this.length = this.endKeyframe - this.startKeyframe + 1;
};
THREE.MorphAnimMesh.prototype.setDirectionForward = function () {
  this.direction = 1;
  this.directionBackwards = !1;
};
THREE.MorphAnimMesh.prototype.setDirectionBackward = function () {
  this.direction = -1;
  this.directionBackwards = !0;
};
THREE.MorphAnimMesh.prototype.parseAnimations = function () {
  var a = this.geometry;
  a.animations || (a.animations = {});
  for (
    var b,
      c = a.animations,
      d = /([a-z]+)(\d+)/,
      e = 0,
      f = a.morphTargets.length;
    e < f;
    e++
  ) {
    var g = a.morphTargets[e].name.match(d);
    if (g && 1 < g.length) {
      g = g[1];
      c[g] || (c[g] = { start: Infinity, end: -Infinity });
      var h = c[g];
      e < h.start && (h.start = e);
      e > h.end && (h.end = e);
      b || (b = g);
    }
  }
  a.firstAnimation = b;
};
THREE.MorphAnimMesh.prototype.setAnimationLabel = function (a, b, c) {
  this.geometry.animations || (this.geometry.animations = {});
  this.geometry.animations[a] = { start: b, end: c };
};
THREE.MorphAnimMesh.prototype.playAnimation = function (a, b) {
  var c = this.geometry.animations[a];
  c
    ? (this.setFrameRange(c.start, c.end),
      (this.duration = 1e3 * ((c.end - c.start) / b)),
      (this.time = 0))
    : console.warn("animation[" + a + "] undefined");
};
THREE.MorphAnimMesh.prototype.updateAnimation = function (a) {
  var b = this.duration / this.length;
  this.time += this.direction * a;
  if (this.mirroredLoop) {
    if (this.time > this.duration || 0 > this.time)
      (this.direction *= -1),
        this.time > this.duration &&
          ((this.time = this.duration), (this.directionBackwards = !0)),
        0 > this.time && ((this.time = 0), (this.directionBackwards = !1));
  } else
    (this.time %= this.duration), 0 > this.time && (this.time += this.duration);
  a =
    this.startKeyframe +
    THREE.Math.clamp(Math.floor(this.time / b), 0, this.length - 1);
  a !== this.currentKeyframe &&
    ((this.morphTargetInfluences[this.lastKeyframe] = 0),
    (this.morphTargetInfluences[this.currentKeyframe] = 1),
    (this.morphTargetInfluences[a] = 0),
    (this.lastKeyframe = this.currentKeyframe),
    (this.currentKeyframe = a));
  b = (this.time % b) / b;
  this.directionBackwards && (b = 1 - b);
  this.morphTargetInfluences[this.currentKeyframe] = b;
  this.morphTargetInfluences[this.lastKeyframe] = 1 - b;
};
THREE.MorphAnimMesh.prototype.clone = function (a) {
  void 0 === a && (a = new THREE.MorphAnimMesh(this.geometry, this.material));
  a.duration = this.duration;
  a.mirroredLoop = this.mirroredLoop;
  a.time = this.time;
  a.lastKeyframe = this.lastKeyframe;
  a.currentKeyframe = this.currentKeyframe;
  a.direction = this.direction;
  a.directionBackwards = this.directionBackwards;
  THREE.Mesh.prototype.clone.call(this, a);
  return a;
};
THREE.Ribbon = function (a, b) {
  THREE.Object3D.call(this);
  this.geometry = a;
  this.material = b;
};
THREE.Ribbon.prototype = Object.create(THREE.Object3D.prototype);
THREE.Ribbon.prototype.clone = function (a) {
  void 0 === a && (a = new THREE.Ribbon(this.geometry, this.material));
  THREE.Object3D.prototype.clone.call(this, a);
  return a;
};
THREE.LOD = function () {
  THREE.Object3D.call(this);
  this.objects = [];
};
THREE.LOD.prototype = Object.create(THREE.Object3D.prototype);
THREE.LOD.prototype.addLevel = function (a, b) {
  void 0 === b && (b = 0);
  for (
    var b = Math.abs(b), c = 0;
    c < this.objects.length && !(b < this.objects[c].distance);
    c++
  );
  this.objects.splice(c, 0, { distance: b, object: a });
  this.add(a);
};
THREE.LOD.prototype.getObjectForDistance = function (a) {
  for (
    var b = 1, c = this.objects.length;
    b < c && !(a < this.objects[b].distance);
    b++
  );
  return this.objects[b - 1].object;
};
THREE.LOD.prototype.update = (function () {
  var a = new THREE.Vector3(),
    b = new THREE.Vector3();
  return function (c) {
    if (1 < this.objects.length) {
      a.getPositionFromMatrix(c.matrixWorld);
      b.getPositionFromMatrix(this.matrixWorld);
      c = a.distanceTo(b);
      this.objects[0].object.visible = !0;
      for (var d = 1, e = this.objects.length; d < e; d++)
        if (c >= this.objects[d].distance)
          (this.objects[d - 1].object.visible = !1),
            (this.objects[d].object.visible = !0);
        else break;
      for (; d < e; d++) this.objects[d].object.visible = !1;
    }
  };
})();
THREE.LOD.prototype.clone = function () {};
THREE.Sprite = function (a) {
  THREE.Object3D.call(this);
  this.material = void 0 !== a ? a : new THREE.SpriteMaterial();
  this.rotation3d = this.rotation;
  this.rotation = 0;
};
THREE.Sprite.prototype = Object.create(THREE.Object3D.prototype);
THREE.Sprite.prototype.updateMatrix = function () {
  this.rotation3d.set(0, 0, this.rotation);
  this.quaternion.setFromEuler(this.rotation3d, this.eulerOrder);
  this.matrix.makeFromPositionQuaternionScale(
    this.position,
    this.quaternion,
    this.scale
  );
  this.matrixWorldNeedsUpdate = !0;
};
THREE.Sprite.prototype.clone = function (a) {
  void 0 === a && (a = new THREE.Sprite(this.material));
  THREE.Object3D.prototype.clone.call(this, a);
  return a;
};
THREE.Scene = function () {
  THREE.Object3D.call(this);
  this.overrideMaterial = this.fog = null;
  this.autoUpdate = !0;
  this.matrixAutoUpdate = !1;
  this.__objects = [];
  this.__lights = [];
  this.__objectsAdded = [];
  this.__objectsRemoved = [];
};
THREE.Scene.prototype = Object.create(THREE.Object3D.prototype);
THREE.Scene.prototype.__addObject = function (a) {
  if (a instanceof THREE.Light)
    -1 === this.__lights.indexOf(a) && this.__lights.push(a),
      a.target && void 0 === a.target.parent && this.add(a.target);
  else if (
    !(a instanceof THREE.Camera || a instanceof THREE.Bone) &&
    -1 === this.__objects.indexOf(a)
  ) {
    this.__objects.push(a);
    this.__objectsAdded.push(a);
    var b = this.__objectsRemoved.indexOf(a);
    -1 !== b && this.__objectsRemoved.splice(b, 1);
  }
  for (b = 0; b < a.children.length; b++) this.__addObject(a.children[b]);
};
THREE.Scene.prototype.__removeObject = function (a) {
  if (a instanceof THREE.Light) {
    var b = this.__lights.indexOf(a);
    -1 !== b && this.__lights.splice(b, 1);
  } else
    a instanceof THREE.Camera ||
      ((b = this.__objects.indexOf(a)),
      -1 !== b &&
        (this.__objects.splice(b, 1),
        this.__objectsRemoved.push(a),
        (b = this.__objectsAdded.indexOf(a)),
        -1 !== b && this.__objectsAdded.splice(b, 1)));
  for (b = 0; b < a.children.length; b++) this.__removeObject(a.children[b]);
};
THREE.Fog = function (a, b, c) {
  this.name = "";
  this.color = new THREE.Color(a);
  this.near = void 0 !== b ? b : 1;
  this.far = void 0 !== c ? c : 1e3;
};
THREE.Fog.prototype.clone = function () {
  return new THREE.Fog(this.color.getHex(), this.near, this.far);
};
THREE.FogExp2 = function (a, b) {
  this.name = "";
  this.color = new THREE.Color(a);
  this.density = void 0 !== b ? b : 2.5e-4;
};
THREE.FogExp2.prototype.clone = function () {
  return new THREE.FogExp2(this.color.getHex(), this.density);
};
THREE.CanvasRenderer = function (a) {
  function b(a) {
    F !== a && (F = t.globalAlpha = a);
  }
  function c(a) {
    z !== a &&
      (a === THREE.NormalBlending
        ? (t.globalCompositeOperation = "source-over")
        : a === THREE.AdditiveBlending
        ? (t.globalCompositeOperation = "lighter")
        : a === THREE.SubtractiveBlending &&
          (t.globalCompositeOperation = "darker"),
      (z = a));
  }
  function d(a) {
    G !== a && (G = t.lineWidth = a);
  }
  function e(a) {
    L !== a && (L = t.lineCap = a);
  }
  function f(a) {
    B !== a && (B = t.lineJoin = a);
  }
  function g(a) {
    H !== a && (H = t.strokeStyle = a);
  }
  function h(a) {
    K !== a && (K = t.fillStyle = a);
  }
  function i(a, b) {
    if (V !== a || C !== b) t.setLineDash([a, b]), (V = a), (C = b);
  }
  console.log("THREE.CanvasRenderer", THREE.REVISION);
  var j = THREE.Math.smoothstep,
    a = a || {},
    m = this,
    p,
    l,
    r,
    s = new THREE.Projector(),
    n = void 0 !== a.canvas ? a.canvas : document.createElement("canvas"),
    q,
    y,
    u,
    x,
    t = n.getContext("2d"),
    E = new THREE.Color(0),
    J = 0,
    F = 1,
    z = 0,
    H = null,
    K = null,
    G = null,
    L = null,
    B = null,
    V = null,
    C = 0,
    I,
    M,
    R,
    ea,
    wa = new THREE.RenderableVertex(),
    Ma = new THREE.RenderableVertex(),
    A,
    ca,
    ja,
    na,
    N,
    fa,
    Wa,
    ab,
    fb,
    Ka,
    qa,
    pa,
    Z = new THREE.Color(),
    ga = new THREE.Color(),
    W = new THREE.Color(),
    da = new THREE.Color(),
    la = new THREE.Color(),
    ha = new THREE.Color(),
    ia = new THREE.Color(),
    Qa = new THREE.Color(),
    kb = {},
    oa = {},
    Xa,
    Ra,
    Aa,
    Sa,
    sb,
    Nb,
    Kb,
    Ob,
    Tb,
    Ub,
    Ta = new THREE.Box2(),
    ua = new THREE.Box2(),
    Ja = new THREE.Box2(),
    tb = new THREE.Color(),
    Na = new THREE.Color(),
    ra = new THREE.Color(),
    bb = new THREE.Vector3(),
    Ab,
    k,
    Bb,
    Ua,
    lb,
    Va,
    Cb = 16;
  Ab = document.createElement("canvas");
  Ab.width = Ab.height = 2;
  k = Ab.getContext("2d");
  k.fillStyle = "rgba(0,0,0,1)";
  k.fillRect(0, 0, 2, 2);
  Bb = k.getImageData(0, 0, 2, 2);
  Ua = Bb.data;
  lb = document.createElement("canvas");
  lb.width = lb.height = Cb;
  Va = lb.getContext("2d");
  Va.translate(-Cb / 2, -Cb / 2);
  Va.scale(Cb, Cb);
  Cb--;
  void 0 === t.setLineDash &&
    (t.setLineDash =
      void 0 !== t.mozDash
        ? function (a) {
            t.mozDash = null !== a[0] ? a : null;
          }
        : function () {});
  this.domElement = n;
  this.devicePixelRatio =
    void 0 !== a.devicePixelRatio
      ? a.devicePixelRatio
      : void 0 !== window.devicePixelRatio
      ? window.devicePixelRatio
      : 1;
  this.sortElements = this.sortObjects = this.autoClear = !0;
  this.info = { render: { vertices: 0, faces: 0 } };
  this.supportsVertexTextures = function () {};
  this.setFaceCulling = function () {};
  this.setSize = function (a, b, c) {
    q = a * this.devicePixelRatio;
    y = b * this.devicePixelRatio;
    u = Math.floor(q / 2);
    x = Math.floor(y / 2);
    n.width = q;
    n.height = y;
    1 !== this.devicePixelRatio &&
      !1 !== c &&
      ((n.style.width = a + "px"), (n.style.height = b + "px"));
    Ta.set(new THREE.Vector2(-u, -x), new THREE.Vector2(u, x));
    ua.set(new THREE.Vector2(-u, -x), new THREE.Vector2(u, x));
    F = 1;
    z = 0;
    B = L = G = K = H = null;
  };
  this.setClearColor = function (a, b) {
    E.set(a);
    J = void 0 !== b ? b : 1;
    ua.set(new THREE.Vector2(-u, -x), new THREE.Vector2(u, x));
  };
  this.setClearColorHex = function (a, b) {
    console.warn(
      "DEPRECATED: .setClearColorHex() is being removed. Use .setClearColor() instead."
    );
    this.setClearColor(a, b);
  };
  this.getMaxAnisotropy = function () {
    return 0;
  };
  this.clear = function () {
    t.setTransform(1, 0, 0, -1, u, x);
    !1 === ua.empty() &&
      (ua.intersect(Ta),
      ua.expandByScalar(2),
      1 > J &&
        t.clearRect(
          ua.min.x | 0,
          ua.min.y | 0,
          (ua.max.x - ua.min.x) | 0,
          (ua.max.y - ua.min.y) | 0
        ),
      0 < J &&
        (c(THREE.NormalBlending),
        b(1),
        h(
          "rgba(" +
            Math.floor(255 * E.r) +
            "," +
            Math.floor(255 * E.g) +
            "," +
            Math.floor(255 * E.b) +
            "," +
            J +
            ")"
        ),
        t.fillRect(
          ua.min.x | 0,
          ua.min.y | 0,
          (ua.max.x - ua.min.x) | 0,
          (ua.max.y - ua.min.y) | 0
        )),
      ua.makeEmpty());
  };
  this.render = function (a, n) {
    function q(a, b, c) {
      for (var d = 0, e = r.length; d < e; d++) {
        var f = r[d];
        Qa.copy(f.color);
        if (f instanceof THREE.DirectionalLight) {
          var g = bb.getPositionFromMatrix(f.matrixWorld).normalize(),
            h = b.dot(g);
          0 >= h || ((h *= f.intensity), c.add(Qa.multiplyScalar(h)));
        } else
          f instanceof THREE.PointLight &&
            ((g = bb.getPositionFromMatrix(f.matrixWorld)),
            (h = b.dot(bb.subVectors(g, a).normalize())),
            0 >= h ||
              ((h *=
                0 == f.distance
                  ? 1
                  : 1 - Math.min(a.distanceTo(g) / f.distance, 1)),
              0 != h && ((h *= f.intensity), c.add(Qa.multiplyScalar(h)))));
      }
    }
    function z(a, d, e, f, g, h, k, i) {
      m.info.render.vertices += 3;
      m.info.render.faces++;
      b(i.opacity);
      c(i.blending);
      A = a.positionScreen.x;
      ca = a.positionScreen.y;
      ja = d.positionScreen.x;
      na = d.positionScreen.y;
      N = e.positionScreen.x;
      fa = e.positionScreen.y;
      y(A, ca, ja, na, N, fa);
      (i instanceof THREE.MeshLambertMaterial ||
        i instanceof THREE.MeshPhongMaterial) &&
      null === i.map
        ? (ha.copy(i.color),
          ia.copy(i.emissive),
          i.vertexColors === THREE.FaceColors && ha.multiply(k.color),
          !1 === i.wireframe &&
          i.shading == THREE.SmoothShading &&
          3 == k.vertexNormalsLength
            ? (ga.copy(tb),
              W.copy(tb),
              da.copy(tb),
              q(k.v1.positionWorld, k.vertexNormalsModel[0], ga),
              q(k.v2.positionWorld, k.vertexNormalsModel[1], W),
              q(k.v3.positionWorld, k.vertexNormalsModel[2], da),
              ga.multiply(ha).add(ia),
              W.multiply(ha).add(ia),
              da.multiply(ha).add(ia),
              la.addColors(W, da).multiplyScalar(0.5),
              (Aa = H(ga, W, da, la)),
              J(A, ca, ja, na, N, fa, 0, 0, 1, 0, 0, 1, Aa))
            : (Z.copy(tb),
              q(k.centroidModel, k.normalModel, Z),
              Z.multiply(ha).add(ia),
              !0 === i.wireframe
                ? E(
                    Z,
                    i.wireframeLinewidth,
                    i.wireframeLinecap,
                    i.wireframeLinejoin
                  )
                : F(Z)))
        : i instanceof THREE.MeshBasicMaterial ||
          i instanceof THREE.MeshLambertMaterial ||
          i instanceof THREE.MeshPhongMaterial
        ? null !== i.map
          ? i.map.mapping instanceof THREE.UVMapping &&
            ((Sa = k.uvs[0]),
            C(
              A,
              ca,
              ja,
              na,
              N,
              fa,
              Sa[f].x,
              Sa[f].y,
              Sa[g].x,
              Sa[g].y,
              Sa[h].x,
              Sa[h].y,
              i.map
            ))
          : null !== i.envMap
          ? i.envMap.mapping instanceof THREE.SphericalReflectionMapping &&
            (bb.copy(k.vertexNormalsModelView[f]),
            (sb = 0.5 * bb.x + 0.5),
            (Nb = 0.5 * bb.y + 0.5),
            bb.copy(k.vertexNormalsModelView[g]),
            (Kb = 0.5 * bb.x + 0.5),
            (Ob = 0.5 * bb.y + 0.5),
            bb.copy(k.vertexNormalsModelView[h]),
            (Tb = 0.5 * bb.x + 0.5),
            (Ub = 0.5 * bb.y + 0.5),
            C(A, ca, ja, na, N, fa, sb, Nb, Kb, Ob, Tb, Ub, i.envMap))
          : (Z.copy(i.color),
            i.vertexColors === THREE.FaceColors && Z.multiply(k.color),
            !0 === i.wireframe
              ? E(
                  Z,
                  i.wireframeLinewidth,
                  i.wireframeLinecap,
                  i.wireframeLinejoin
                )
              : F(Z))
        : i instanceof THREE.MeshDepthMaterial
        ? ((Xa = n.near),
          (Ra = n.far),
          (ga.r =
            ga.g =
            ga.b =
              1 - j(a.positionScreen.z * a.positionScreen.w, Xa, Ra)),
          (W.r =
            W.g =
            W.b =
              1 - j(d.positionScreen.z * d.positionScreen.w, Xa, Ra)),
          (da.r =
            da.g =
            da.b =
              1 - j(e.positionScreen.z * e.positionScreen.w, Xa, Ra)),
          la.addColors(W, da).multiplyScalar(0.5),
          (Aa = H(ga, W, da, la)),
          J(A, ca, ja, na, N, fa, 0, 0, 1, 0, 0, 1, Aa))
        : i instanceof THREE.MeshNormalMaterial &&
          (i.shading == THREE.FlatShading
            ? ((a = k.normalModelView),
              Z.setRGB(a.x, a.y, a.z).multiplyScalar(0.5).addScalar(0.5),
              !0 === i.wireframe
                ? E(
                    Z,
                    i.wireframeLinewidth,
                    i.wireframeLinecap,
                    i.wireframeLinejoin
                  )
                : F(Z))
            : i.shading == THREE.SmoothShading &&
              ((a = k.vertexNormalsModelView[f]),
              ga.setRGB(a.x, a.y, a.z).multiplyScalar(0.5).addScalar(0.5),
              (a = k.vertexNormalsModelView[g]),
              W.setRGB(a.x, a.y, a.z).multiplyScalar(0.5).addScalar(0.5),
              (a = k.vertexNormalsModelView[h]),
              da.setRGB(a.x, a.y, a.z).multiplyScalar(0.5).addScalar(0.5),
              la.addColors(W, da).multiplyScalar(0.5),
              (Aa = H(ga, W, da, la)),
              J(A, ca, ja, na, N, fa, 0, 0, 1, 0, 0, 1, Aa)));
    }
    function y(a, b, c, d, e, f) {
      t.beginPath();
      t.moveTo(a, b);
      t.lineTo(c, d);
      t.lineTo(e, f);
      t.closePath();
    }
    function B(a, b, c, d, e, f, g, h) {
      t.beginPath();
      t.moveTo(a, b);
      t.lineTo(c, d);
      t.lineTo(e, f);
      t.lineTo(g, h);
      t.closePath();
    }
    function E(a, b, c, h) {
      d(b);
      e(c);
      f(h);
      g(a.getStyle());
      t.stroke();
      Ja.expandByScalar(2 * b);
    }
    function F(a) {
      h(a.getStyle());
      t.fill();
    }
    function C(a, b, c, d, e, f, g, i, k, xa, j, l, p) {
      if (
        !(
          p instanceof THREE.DataTexture ||
          void 0 === p.image ||
          0 == p.image.width
        )
      ) {
        if (!0 === p.needsUpdate) {
          var m = p.wrapS == THREE.RepeatWrapping,
            Ya = p.wrapT == THREE.RepeatWrapping;
          kb[p.id] = t.createPattern(
            p.image,
            !0 === m && !0 === Ya
              ? "repeat"
              : !0 === m && !1 === Ya
              ? "repeat-x"
              : !1 === m && !0 === Ya
              ? "repeat-y"
              : "no-repeat"
          );
          p.needsUpdate = !1;
        }
        void 0 === kb[p.id] ? h("rgba(0,0,0,1)") : h(kb[p.id]);
        var m = p.offset.x / p.repeat.x,
          Ya = p.offset.y / p.repeat.y,
          n = p.image.width * p.repeat.x,
          q = p.image.height * p.repeat.y,
          g = (g + m) * n,
          i = (1 - i + Ya) * q,
          c = c - a,
          d = d - b,
          e = e - a,
          f = f - b,
          k = (k + m) * n - g,
          xa = (1 - xa + Ya) * q - i,
          j = (j + m) * n - g,
          l = (1 - l + Ya) * q - i,
          m = k * l - j * xa;
        0 === m
          ? (void 0 === oa[p.id] &&
              ((b = document.createElement("canvas")),
              (b.width = p.image.width),
              (b.height = p.image.height),
              (b = b.getContext("2d")),
              b.drawImage(p.image, 0, 0),
              (oa[p.id] = b.getImageData(
                0,
                0,
                p.image.width,
                p.image.height
              ).data)),
            (b = oa[p.id]),
            (g = 4 * (Math.floor(g) + Math.floor(i) * p.image.width)),
            Z.setRGB(b[g] / 255, b[g + 1] / 255, b[g + 2] / 255),
            F(Z))
          : ((m = 1 / m),
            (p = (l * c - xa * e) * m),
            (xa = (l * d - xa * f) * m),
            (c = (k * e - j * c) * m),
            (d = (k * f - j * d) * m),
            (a = a - p * g - c * i),
            (g = b - xa * g - d * i),
            t.save(),
            t.transform(p, xa, c, d, a, g),
            t.fill(),
            t.restore());
      }
    }
    function J(a, b, c, d, e, f, g, h, i, k, xa, j, p) {
      var m, l;
      m = p.width - 1;
      l = p.height - 1;
      g *= m;
      h *= l;
      c -= a;
      d -= b;
      e -= a;
      f -= b;
      i = i * m - g;
      k = k * l - h;
      xa = xa * m - g;
      j = j * l - h;
      l = 1 / (i * j - xa * k);
      m = (j * c - k * e) * l;
      k = (j * d - k * f) * l;
      c = (i * e - xa * c) * l;
      d = (i * f - xa * d) * l;
      a = a - m * g - c * h;
      b = b - k * g - d * h;
      t.save();
      t.transform(m, k, c, d, a, b);
      t.clip();
      t.drawImage(p, 0, 0);
      t.restore();
    }
    function H(a, b, c, d) {
      Ua[0] = (255 * a.r) | 0;
      Ua[1] = (255 * a.g) | 0;
      Ua[2] = (255 * a.b) | 0;
      Ua[4] = (255 * b.r) | 0;
      Ua[5] = (255 * b.g) | 0;
      Ua[6] = (255 * b.b) | 0;
      Ua[8] = (255 * c.r) | 0;
      Ua[9] = (255 * c.g) | 0;
      Ua[10] = (255 * c.b) | 0;
      Ua[12] = (255 * d.r) | 0;
      Ua[13] = (255 * d.g) | 0;
      Ua[14] = (255 * d.b) | 0;
      k.putImageData(Bb, 0, 0);
      Va.drawImage(Ab, 0, 0);
      return lb;
    }
    function G(a, b) {
      var c = b.x - a.x,
        d = b.y - a.y,
        e = c * c + d * d;
      0 !== e &&
        ((e = 1 / Math.sqrt(e)),
        (c *= e),
        (d *= e),
        (b.x += c),
        (b.y += d),
        (a.x -= c),
        (a.y -= d));
    }
    if (!1 === n instanceof THREE.Camera)
      console.error(
        "THREE.CanvasRenderer.render: camera is not an instance of THREE.Camera."
      );
    else {
      !0 === this.autoClear && this.clear();
      t.setTransform(1, 0, 0, -1, u, x);
      m.info.render.vertices = 0;
      m.info.render.faces = 0;
      p = s.projectScene(a, n, this.sortObjects, this.sortElements);
      l = p.elements;
      r = p.lights;
      tb.setRGB(0, 0, 0);
      Na.setRGB(0, 0, 0);
      ra.setRGB(0, 0, 0);
      for (var K = 0, V = r.length; K < V; K++) {
        var U = r[K],
          P = U.color;
        U instanceof THREE.AmbientLight
          ? tb.add(P)
          : U instanceof THREE.DirectionalLight
          ? Na.add(P)
          : U instanceof THREE.PointLight && ra.add(P);
      }
      K = 0;
      for (V = l.length; K < V; K++) {
        var L = l[K],
          U = L.material;
        if (!(void 0 === U || !1 === U.visible)) {
          Ja.makeEmpty();
          if (L instanceof THREE.RenderableParticle) {
            I = L;
            I.x *= u;
            I.y *= x;
            P = I;
            b(U.opacity);
            c(U.blending);
            var xa = void 0,
              mb = void 0,
              Ya = void 0,
              vb = void 0,
              Pb = void 0,
              Oc = void 0,
              Pc = void 0;
            U instanceof THREE.ParticleBasicMaterial
              ? null === U.map
                ? ((Ya = L.object.scale.x),
                  (vb = L.object.scale.y),
                  (Ya *= L.scale.x * u),
                  (vb *= L.scale.y * x),
                  Ja.min.set(P.x - Ya, P.y - vb),
                  Ja.max.set(P.x + Ya, P.y + vb),
                  !1 === Ta.isIntersectionBox(Ja)
                    ? Ja.makeEmpty()
                    : (h(U.color.getStyle()),
                      t.save(),
                      t.translate(P.x, P.y),
                      t.rotate(-L.rotation),
                      t.scale(Ya, vb),
                      t.fillRect(-1, -1, 2, 2),
                      t.restore()))
                : ((Pb = U.map.image),
                  (Oc = Pb.width >> 1),
                  (Pc = Pb.height >> 1),
                  (Ya = L.scale.x * u),
                  (vb = L.scale.y * x),
                  (xa = Ya * Oc),
                  (mb = vb * Pc),
                  Ja.min.set(P.x - xa, P.y - mb),
                  Ja.max.set(P.x + xa, P.y + mb),
                  !1 === Ta.isIntersectionBox(Ja)
                    ? Ja.makeEmpty()
                    : (t.save(),
                      t.translate(P.x, P.y),
                      t.rotate(-L.rotation),
                      t.scale(Ya, -vb),
                      t.translate(-Oc, -Pc),
                      t.drawImage(Pb, 0, 0),
                      t.restore()))
              : U instanceof THREE.ParticleCanvasMaterial &&
                ((xa = L.scale.x * u),
                (mb = L.scale.y * x),
                Ja.min.set(P.x - xa, P.y - mb),
                Ja.max.set(P.x + xa, P.y + mb),
                !1 === Ta.isIntersectionBox(Ja)
                  ? Ja.makeEmpty()
                  : (g(U.color.getStyle()),
                    h(U.color.getStyle()),
                    t.save(),
                    t.translate(P.x, P.y),
                    t.rotate(-L.rotation),
                    t.scale(xa, mb),
                    U.program(t),
                    t.restore()));
          } else if (L instanceof THREE.RenderableLine) {
            if (
              ((I = L.v1),
              (M = L.v2),
              (I.positionScreen.x *= u),
              (I.positionScreen.y *= x),
              (M.positionScreen.x *= u),
              (M.positionScreen.y *= x),
              Ja.setFromPoints([I.positionScreen, M.positionScreen]),
              !0 === Ta.isIntersectionBox(Ja))
            )
              if (
                ((P = I),
                (xa = M),
                b(U.opacity),
                c(U.blending),
                t.beginPath(),
                t.moveTo(P.positionScreen.x, P.positionScreen.y),
                t.lineTo(xa.positionScreen.x, xa.positionScreen.y),
                U instanceof THREE.LineBasicMaterial)
              ) {
                d(U.linewidth);
                e(U.linecap);
                f(U.linejoin);
                if (U.vertexColors !== THREE.VertexColors)
                  g(U.color.getStyle());
                else if (
                  ((mb = L.vertexColors[0].getStyle()),
                  (L = L.vertexColors[1].getStyle()),
                  mb === L)
                )
                  g(mb);
                else {
                  try {
                    var qc = t.createLinearGradient(
                      P.positionScreen.x,
                      P.positionScreen.y,
                      xa.positionScreen.x,
                      xa.positionScreen.y
                    );
                    qc.addColorStop(0, mb);
                    qc.addColorStop(1, L);
                  } catch (ed) {
                    qc = mb;
                  }
                  g(qc);
                }
                t.stroke();
                Ja.expandByScalar(2 * U.linewidth);
              } else
                U instanceof THREE.LineDashedMaterial &&
                  (d(U.linewidth),
                  e(U.linecap),
                  f(U.linejoin),
                  g(U.color.getStyle()),
                  i(U.dashSize, U.gapSize),
                  t.stroke(),
                  Ja.expandByScalar(2 * U.linewidth),
                  i(null, null));
          } else if (L instanceof THREE.RenderableFace3) {
            I = L.v1;
            M = L.v2;
            R = L.v3;
            if (-1 > I.positionScreen.z || 1 < I.positionScreen.z) continue;
            if (-1 > M.positionScreen.z || 1 < M.positionScreen.z) continue;
            if (-1 > R.positionScreen.z || 1 < R.positionScreen.z) continue;
            I.positionScreen.x *= u;
            I.positionScreen.y *= x;
            M.positionScreen.x *= u;
            M.positionScreen.y *= x;
            R.positionScreen.x *= u;
            R.positionScreen.y *= x;
            !0 === U.overdraw &&
              (G(I.positionScreen, M.positionScreen),
              G(M.positionScreen, R.positionScreen),
              G(R.positionScreen, I.positionScreen));
            Ja.setFromPoints([
              I.positionScreen,
              M.positionScreen,
              R.positionScreen,
            ]);
            !0 === Ta.isIntersectionBox(Ja) && z(I, M, R, 0, 1, 2, L, U);
          } else if (L instanceof THREE.RenderableFace4) {
            I = L.v1;
            M = L.v2;
            R = L.v3;
            ea = L.v4;
            if (-1 > I.positionScreen.z || 1 < I.positionScreen.z) continue;
            if (-1 > M.positionScreen.z || 1 < M.positionScreen.z) continue;
            if (-1 > R.positionScreen.z || 1 < R.positionScreen.z) continue;
            if (-1 > ea.positionScreen.z || 1 < ea.positionScreen.z) continue;
            I.positionScreen.x *= u;
            I.positionScreen.y *= x;
            M.positionScreen.x *= u;
            M.positionScreen.y *= x;
            R.positionScreen.x *= u;
            R.positionScreen.y *= x;
            ea.positionScreen.x *= u;
            ea.positionScreen.y *= x;
            wa.positionScreen.copy(M.positionScreen);
            Ma.positionScreen.copy(ea.positionScreen);
            !0 === U.overdraw &&
              (G(I.positionScreen, M.positionScreen),
              G(M.positionScreen, ea.positionScreen),
              G(ea.positionScreen, I.positionScreen),
              G(R.positionScreen, wa.positionScreen),
              G(R.positionScreen, Ma.positionScreen));
            Ja.setFromPoints([
              I.positionScreen,
              M.positionScreen,
              R.positionScreen,
              ea.positionScreen,
            ]);
            !0 === Ta.isIntersectionBox(Ja) &&
              ((P = I),
              (xa = M),
              (mb = R),
              (Ya = ea),
              (vb = wa),
              (Pb = Ma),
              (m.info.render.vertices += 4),
              m.info.render.faces++,
              b(U.opacity),
              c(U.blending),
              (void 0 !== U.map && null !== U.map) ||
              (void 0 !== U.envMap && null !== U.envMap)
                ? (z(P, xa, Ya, 0, 1, 3, L, U), z(vb, mb, Pb, 1, 2, 3, L, U))
                : ((A = P.positionScreen.x),
                  (ca = P.positionScreen.y),
                  (ja = xa.positionScreen.x),
                  (na = xa.positionScreen.y),
                  (N = mb.positionScreen.x),
                  (fa = mb.positionScreen.y),
                  (Wa = Ya.positionScreen.x),
                  (ab = Ya.positionScreen.y),
                  (fb = vb.positionScreen.x),
                  (Ka = vb.positionScreen.y),
                  (qa = Pb.positionScreen.x),
                  (pa = Pb.positionScreen.y),
                  U instanceof THREE.MeshLambertMaterial ||
                  U instanceof THREE.MeshPhongMaterial
                    ? (ha.copy(U.color),
                      ia.copy(U.emissive),
                      U.vertexColors === THREE.FaceColors &&
                        ha.multiply(L.color),
                      !1 === U.wireframe &&
                      U.shading == THREE.SmoothShading &&
                      4 == L.vertexNormalsLength
                        ? (ga.copy(tb),
                          W.copy(tb),
                          da.copy(tb),
                          la.copy(tb),
                          q(L.v1.positionWorld, L.vertexNormalsModel[0], ga),
                          q(L.v2.positionWorld, L.vertexNormalsModel[1], W),
                          q(L.v4.positionWorld, L.vertexNormalsModel[3], da),
                          q(L.v3.positionWorld, L.vertexNormalsModel[2], la),
                          ga.multiply(ha).add(ia),
                          W.multiply(ha).add(ia),
                          da.multiply(ha).add(ia),
                          la.multiply(ha).add(ia),
                          (Aa = H(ga, W, da, la)),
                          y(A, ca, ja, na, Wa, ab),
                          J(A, ca, ja, na, Wa, ab, 0, 0, 1, 0, 0, 1, Aa),
                          y(fb, Ka, N, fa, qa, pa),
                          J(fb, Ka, N, fa, qa, pa, 1, 0, 1, 1, 0, 1, Aa))
                        : (Z.copy(tb),
                          q(L.centroidModel, L.normalModel, Z),
                          Z.multiply(ha).add(ia),
                          B(A, ca, ja, na, N, fa, Wa, ab),
                          !0 === U.wireframe
                            ? E(
                                Z,
                                U.wireframeLinewidth,
                                U.wireframeLinecap,
                                U.wireframeLinejoin
                              )
                            : F(Z)))
                    : U instanceof THREE.MeshBasicMaterial
                    ? (Z.copy(U.color),
                      U.vertexColors === THREE.FaceColors &&
                        Z.multiply(L.color),
                      B(A, ca, ja, na, N, fa, Wa, ab),
                      !0 === U.wireframe
                        ? E(
                            Z,
                            U.wireframeLinewidth,
                            U.wireframeLinecap,
                            U.wireframeLinejoin
                          )
                        : F(Z))
                    : U instanceof THREE.MeshNormalMaterial
                    ? ((P = void 0),
                      U.shading == THREE.FlatShading
                        ? ((P = L.normalModelView),
                          Z.setRGB(P.x, P.y, P.z)
                            .multiplyScalar(0.5)
                            .addScalar(0.5),
                          B(A, ca, ja, na, N, fa, Wa, ab),
                          !0 === U.wireframe
                            ? E(
                                Z,
                                U.wireframeLinewidth,
                                U.wireframeLinecap,
                                U.wireframeLinejoin
                              )
                            : F(Z))
                        : U.shading == THREE.SmoothShading &&
                          ((P = L.vertexNormalsModelView[0]),
                          ga
                            .setRGB(P.x, P.y, P.z)
                            .multiplyScalar(0.5)
                            .addScalar(0.5),
                          (P = L.vertexNormalsModelView[1]),
                          W.setRGB(P.x, P.y, P.z)
                            .multiplyScalar(0.5)
                            .addScalar(0.5),
                          (P = L.vertexNormalsModelView[3]),
                          da
                            .setRGB(P.x, P.y, P.z)
                            .multiplyScalar(0.5)
                            .addScalar(0.5),
                          (P = L.vertexNormalsModelView[2]),
                          la
                            .setRGB(P.x, P.y, P.z)
                            .multiplyScalar(0.5)
                            .addScalar(0.5),
                          (Aa = H(ga, W, da, la)),
                          y(A, ca, ja, na, Wa, ab),
                          J(A, ca, ja, na, Wa, ab, 0, 0, 1, 0, 0, 1, Aa),
                          y(fb, Ka, N, fa, qa, pa),
                          J(fb, Ka, N, fa, qa, pa, 1, 0, 1, 1, 0, 1, Aa)))
                    : U instanceof THREE.MeshDepthMaterial &&
                      ((Xa = n.near),
                      (Ra = n.far),
                      (ga.r =
                        ga.g =
                        ga.b =
                          1 -
                          j(P.positionScreen.z * P.positionScreen.w, Xa, Ra)),
                      (W.r =
                        W.g =
                        W.b =
                          1 -
                          j(xa.positionScreen.z * xa.positionScreen.w, Xa, Ra)),
                      (da.r =
                        da.g =
                        da.b =
                          1 -
                          j(Ya.positionScreen.z * Ya.positionScreen.w, Xa, Ra)),
                      (la.r =
                        la.g =
                        la.b =
                          1 -
                          j(mb.positionScreen.z * mb.positionScreen.w, Xa, Ra)),
                      (Aa = H(ga, W, da, la)),
                      y(A, ca, ja, na, Wa, ab),
                      J(A, ca, ja, na, Wa, ab, 0, 0, 1, 0, 0, 1, Aa),
                      y(fb, Ka, N, fa, qa, pa),
                      J(fb, Ka, N, fa, qa, pa, 1, 0, 1, 1, 0, 1, Aa))));
          }
          ua.union(Ja);
        }
      }
      t.setTransform(1, 0, 0, 1, 0, 0);
    }
  };
};
THREE.ShaderChunk = {
  fog_pars_fragment:
    "#ifdef USE_FOG\nuniform vec3 fogColor;\n#ifdef FOG_EXP2\nuniform float fogDensity;\n#else\nuniform float fogNear;\nuniform float fogFar;\n#endif\n#endif",
  fog_fragment:
    "#ifdef USE_FOG\nfloat depth = gl_FragCoord.z / gl_FragCoord.w;\n#ifdef FOG_EXP2\nconst float LOG2 = 1.442695;\nfloat fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );\nfogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );\n#else\nfloat fogFactor = smoothstep( fogNear, fogFar, depth );\n#endif\ngl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor );\n#endif",
  envmap_pars_fragment:
    "#ifdef USE_ENVMAP\nuniform float reflectivity;\nuniform samplerCube envMap;\nuniform float flipEnvMap;\nuniform int combine;\n#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP )\nuniform bool useRefract;\nuniform float refractionRatio;\n#else\nvarying vec3 vReflect;\n#endif\n#endif",
  envmap_fragment:
    "#ifdef USE_ENVMAP\nvec3 reflectVec;\n#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP )\nvec3 cameraToVertex = normalize( vWorldPosition - cameraPosition );\nif ( useRefract ) {\nreflectVec = refract( cameraToVertex, normal, refractionRatio );\n} else { \nreflectVec = reflect( cameraToVertex, normal );\n}\n#else\nreflectVec = vReflect;\n#endif\n#ifdef DOUBLE_SIDED\nfloat flipNormal = ( -1.0 + 2.0 * float( gl_FrontFacing ) );\nvec4 cubeColor = textureCube( envMap, flipNormal * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );\n#else\nvec4 cubeColor = textureCube( envMap, vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );\n#endif\n#ifdef GAMMA_INPUT\ncubeColor.xyz *= cubeColor.xyz;\n#endif\nif ( combine == 1 ) {\ngl_FragColor.xyz = mix( gl_FragColor.xyz, cubeColor.xyz, specularStrength * reflectivity );\n} else if ( combine == 2 ) {\ngl_FragColor.xyz += cubeColor.xyz * specularStrength * reflectivity;\n} else {\ngl_FragColor.xyz = mix( gl_FragColor.xyz, gl_FragColor.xyz * cubeColor.xyz, specularStrength * reflectivity );\n}\n#endif",
  envmap_pars_vertex:
    "#if defined( USE_ENVMAP ) && ! defined( USE_BUMPMAP ) && ! defined( USE_NORMALMAP )\nvarying vec3 vReflect;\nuniform float refractionRatio;\nuniform bool useRefract;\n#endif",
  worldpos_vertex:
    "#if defined( USE_ENVMAP ) || defined( PHONG ) || defined( LAMBERT ) || defined ( USE_SHADOWMAP )\n#ifdef USE_SKINNING\nvec4 worldPosition = modelMatrix * skinned;\n#endif\n#if defined( USE_MORPHTARGETS ) && ! defined( USE_SKINNING )\nvec4 worldPosition = modelMatrix * vec4( morphed, 1.0 );\n#endif\n#if ! defined( USE_MORPHTARGETS ) && ! defined( USE_SKINNING )\nvec4 worldPosition = modelMatrix * vec4( position, 1.0 );\n#endif\n#endif",
  envmap_vertex:
    "#if defined( USE_ENVMAP ) && ! defined( USE_BUMPMAP ) && ! defined( USE_NORMALMAP )\nvec3 worldNormal = mat3( modelMatrix[ 0 ].xyz, modelMatrix[ 1 ].xyz, modelMatrix[ 2 ].xyz ) * objectNormal;\nworldNormal = normalize( worldNormal );\nvec3 cameraToVertex = normalize( worldPosition.xyz - cameraPosition );\nif ( useRefract ) {\nvReflect = refract( cameraToVertex, worldNormal, refractionRatio );\n} else {\nvReflect = reflect( cameraToVertex, worldNormal );\n}\n#endif",
  map_particle_pars_fragment: "#ifdef USE_MAP\nuniform sampler2D map;\n#endif",
  map_particle_fragment:
    "#ifdef USE_MAP\ngl_FragColor = gl_FragColor * texture2D( map, vec2( gl_PointCoord.x, 1.0 - gl_PointCoord.y ) );\n#endif",
  map_pars_vertex:
    "#if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP )\nvarying vec2 vUv;\nuniform vec4 offsetRepeat;\n#endif",
  map_pars_fragment:
    "#if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP )\nvarying vec2 vUv;\n#endif\n#ifdef USE_MAP\nuniform sampler2D map;\n#endif",
  map_vertex:
    "#if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP )\nvUv = uv * offsetRepeat.zw + offsetRepeat.xy;\n#endif",
  map_fragment:
    "#ifdef USE_MAP\nvec4 texelColor = texture2D( map, vUv );\n#ifdef GAMMA_INPUT\ntexelColor.xyz *= texelColor.xyz;\n#endif\ngl_FragColor = gl_FragColor * texelColor;\n#endif",
  lightmap_pars_fragment:
    "#ifdef USE_LIGHTMAP\nvarying vec2 vUv2;\nuniform sampler2D lightMap;\n#endif",
  lightmap_pars_vertex: "#ifdef USE_LIGHTMAP\nvarying vec2 vUv2;\n#endif",
  lightmap_fragment:
    "#ifdef USE_LIGHTMAP\ngl_FragColor = gl_FragColor * texture2D( lightMap, vUv2 );\n#endif",
  lightmap_vertex: "#ifdef USE_LIGHTMAP\nvUv2 = uv2;\n#endif",
  bumpmap_pars_fragment:
    "#ifdef USE_BUMPMAP\nuniform sampler2D bumpMap;\nuniform float bumpScale;\nvec2 dHdxy_fwd() {\nvec2 dSTdx = dFdx( vUv );\nvec2 dSTdy = dFdy( vUv );\nfloat Hll = bumpScale * texture2D( bumpMap, vUv ).x;\nfloat dBx = bumpScale * texture2D( bumpMap, vUv + dSTdx ).x - Hll;\nfloat dBy = bumpScale * texture2D( bumpMap, vUv + dSTdy ).x - Hll;\nreturn vec2( dBx, dBy );\n}\nvec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy ) {\nvec3 vSigmaX = dFdx( surf_pos );\nvec3 vSigmaY = dFdy( surf_pos );\nvec3 vN = surf_norm;\nvec3 R1 = cross( vSigmaY, vN );\nvec3 R2 = cross( vN, vSigmaX );\nfloat fDet = dot( vSigmaX, R1 );\nvec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );\nreturn normalize( abs( fDet ) * surf_norm - vGrad );\n}\n#endif",
  normalmap_pars_fragment:
    "#ifdef USE_NORMALMAP\nuniform sampler2D normalMap;\nuniform vec2 normalScale;\nvec3 perturbNormal2Arb( vec3 eye_pos, vec3 surf_norm ) {\nvec3 q0 = dFdx( eye_pos.xyz );\nvec3 q1 = dFdy( eye_pos.xyz );\nvec2 st0 = dFdx( vUv.st );\nvec2 st1 = dFdy( vUv.st );\nvec3 S = normalize(  q0 * st1.t - q1 * st0.t );\nvec3 T = normalize( -q0 * st1.s + q1 * st0.s );\nvec3 N = normalize( surf_norm );\nvec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;\nmapN.xy = normalScale * mapN.xy;\nmat3 tsn = mat3( S, T, N );\nreturn normalize( tsn * mapN );\n}\n#endif",
  specularmap_pars_fragment:
    "#ifdef USE_SPECULARMAP\nuniform sampler2D specularMap;\n#endif",
  specularmap_fragment:
    "float specularStrength;\n#ifdef USE_SPECULARMAP\nvec4 texelSpecular = texture2D( specularMap, vUv );\nspecularStrength = texelSpecular.r;\n#else\nspecularStrength = 1.0;\n#endif",
  lights_lambert_pars_vertex:
    "uniform vec3 ambient;\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform vec3 ambientLightColor;\n#if MAX_DIR_LIGHTS > 0\nuniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];\nuniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];\n#endif\n#if MAX_HEMI_LIGHTS > 0\nuniform vec3 hemisphereLightSkyColor[ MAX_HEMI_LIGHTS ];\nuniform vec3 hemisphereLightGroundColor[ MAX_HEMI_LIGHTS ];\nuniform vec3 hemisphereLightDirection[ MAX_HEMI_LIGHTS ];\n#endif\n#if MAX_POINT_LIGHTS > 0\nuniform vec3 pointLightColor[ MAX_POINT_LIGHTS ];\nuniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];\nuniform float pointLightDistance[ MAX_POINT_LIGHTS ];\n#endif\n#if MAX_SPOT_LIGHTS > 0\nuniform vec3 spotLightColor[ MAX_SPOT_LIGHTS ];\nuniform vec3 spotLightPosition[ MAX_SPOT_LIGHTS ];\nuniform vec3 spotLightDirection[ MAX_SPOT_LIGHTS ];\nuniform float spotLightDistance[ MAX_SPOT_LIGHTS ];\nuniform float spotLightAngleCos[ MAX_SPOT_LIGHTS ];\nuniform float spotLightExponent[ MAX_SPOT_LIGHTS ];\n#endif\n#ifdef WRAP_AROUND\nuniform vec3 wrapRGB;\n#endif",
  lights_lambert_vertex:
    "vLightFront = vec3( 0.0 );\n#ifdef DOUBLE_SIDED\nvLightBack = vec3( 0.0 );\n#endif\ntransformedNormal = normalize( transformedNormal );\n#if MAX_DIR_LIGHTS > 0\nfor( int i = 0; i < MAX_DIR_LIGHTS; i ++ ) {\nvec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );\nvec3 dirVector = normalize( lDirection.xyz );\nfloat dotProduct = dot( transformedNormal, dirVector );\nvec3 directionalLightWeighting = vec3( max( dotProduct, 0.0 ) );\n#ifdef DOUBLE_SIDED\nvec3 directionalLightWeightingBack = vec3( max( -dotProduct, 0.0 ) );\n#ifdef WRAP_AROUND\nvec3 directionalLightWeightingHalfBack = vec3( max( -0.5 * dotProduct + 0.5, 0.0 ) );\n#endif\n#endif\n#ifdef WRAP_AROUND\nvec3 directionalLightWeightingHalf = vec3( max( 0.5 * dotProduct + 0.5, 0.0 ) );\ndirectionalLightWeighting = mix( directionalLightWeighting, directionalLightWeightingHalf, wrapRGB );\n#ifdef DOUBLE_SIDED\ndirectionalLightWeightingBack = mix( directionalLightWeightingBack, directionalLightWeightingHalfBack, wrapRGB );\n#endif\n#endif\nvLightFront += directionalLightColor[ i ] * directionalLightWeighting;\n#ifdef DOUBLE_SIDED\nvLightBack += directionalLightColor[ i ] * directionalLightWeightingBack;\n#endif\n}\n#endif\n#if MAX_POINT_LIGHTS > 0\nfor( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {\nvec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );\nvec3 lVector = lPosition.xyz - mvPosition.xyz;\nfloat lDistance = 1.0;\nif ( pointLightDistance[ i ] > 0.0 )\nlDistance = 1.0 - min( ( length( lVector ) / pointLightDistance[ i ] ), 1.0 );\nlVector = normalize( lVector );\nfloat dotProduct = dot( transformedNormal, lVector );\nvec3 pointLightWeighting = vec3( max( dotProduct, 0.0 ) );\n#ifdef DOUBLE_SIDED\nvec3 pointLightWeightingBack = vec3( max( -dotProduct, 0.0 ) );\n#ifdef WRAP_AROUND\nvec3 pointLightWeightingHalfBack = vec3( max( -0.5 * dotProduct + 0.5, 0.0 ) );\n#endif\n#endif\n#ifdef WRAP_AROUND\nvec3 pointLightWeightingHalf = vec3( max( 0.5 * dotProduct + 0.5, 0.0 ) );\npointLightWeighting = mix( pointLightWeighting, pointLightWeightingHalf, wrapRGB );\n#ifdef DOUBLE_SIDED\npointLightWeightingBack = mix( pointLightWeightingBack, pointLightWeightingHalfBack, wrapRGB );\n#endif\n#endif\nvLightFront += pointLightColor[ i ] * pointLightWeighting * lDistance;\n#ifdef DOUBLE_SIDED\nvLightBack += pointLightColor[ i ] * pointLightWeightingBack * lDistance;\n#endif\n}\n#endif\n#if MAX_SPOT_LIGHTS > 0\nfor( int i = 0; i < MAX_SPOT_LIGHTS; i ++ ) {\nvec4 lPosition = viewMatrix * vec4( spotLightPosition[ i ], 1.0 );\nvec3 lVector = lPosition.xyz - mvPosition.xyz;\nfloat spotEffect = dot( spotLightDirection[ i ], normalize( spotLightPosition[ i ] - worldPosition.xyz ) );\nif ( spotEffect > spotLightAngleCos[ i ] ) {\nspotEffect = max( pow( spotEffect, spotLightExponent[ i ] ), 0.0 );\nfloat lDistance = 1.0;\nif ( spotLightDistance[ i ] > 0.0 )\nlDistance = 1.0 - min( ( length( lVector ) / spotLightDistance[ i ] ), 1.0 );\nlVector = normalize( lVector );\nfloat dotProduct = dot( transformedNormal, lVector );\nvec3 spotLightWeighting = vec3( max( dotProduct, 0.0 ) );\n#ifdef DOUBLE_SIDED\nvec3 spotLightWeightingBack = vec3( max( -dotProduct, 0.0 ) );\n#ifdef WRAP_AROUND\nvec3 spotLightWeightingHalfBack = vec3( max( -0.5 * dotProduct + 0.5, 0.0 ) );\n#endif\n#endif\n#ifdef WRAP_AROUND\nvec3 spotLightWeightingHalf = vec3( max( 0.5 * dotProduct + 0.5, 0.0 ) );\nspotLightWeighting = mix( spotLightWeighting, spotLightWeightingHalf, wrapRGB );\n#ifdef DOUBLE_SIDED\nspotLightWeightingBack = mix( spotLightWeightingBack, spotLightWeightingHalfBack, wrapRGB );\n#endif\n#endif\nvLightFront += spotLightColor[ i ] * spotLightWeighting * lDistance * spotEffect;\n#ifdef DOUBLE_SIDED\nvLightBack += spotLightColor[ i ] * spotLightWeightingBack * lDistance * spotEffect;\n#endif\n}\n}\n#endif\n#if MAX_HEMI_LIGHTS > 0\nfor( int i = 0; i < MAX_HEMI_LIGHTS; i ++ ) {\nvec4 lDirection = viewMatrix * vec4( hemisphereLightDirection[ i ], 0.0 );\nvec3 lVector = normalize( lDirection.xyz );\nfloat dotProduct = dot( transformedNormal, lVector );\nfloat hemiDiffuseWeight = 0.5 * dotProduct + 0.5;\nfloat hemiDiffuseWeightBack = -0.5 * dotProduct + 0.5;\nvLightFront += mix( hemisphereLightGroundColor[ i ], hemisphereLightSkyColor[ i ], hemiDiffuseWeight );\n#ifdef DOUBLE_SIDED\nvLightBack += mix( hemisphereLightGroundColor[ i ], hemisphereLightSkyColor[ i ], hemiDiffuseWeightBack );\n#endif\n}\n#endif\nvLightFront = vLightFront * diffuse + ambient * ambientLightColor + emissive;\n#ifdef DOUBLE_SIDED\nvLightBack = vLightBack * diffuse + ambient * ambientLightColor + emissive;\n#endif",
  lights_phong_pars_vertex:
    "#ifndef PHONG_PER_PIXEL\n#if MAX_POINT_LIGHTS > 0\nuniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];\nuniform float pointLightDistance[ MAX_POINT_LIGHTS ];\nvarying vec4 vPointLight[ MAX_POINT_LIGHTS ];\n#endif\n#if MAX_SPOT_LIGHTS > 0\nuniform vec3 spotLightPosition[ MAX_SPOT_LIGHTS ];\nuniform float spotLightDistance[ MAX_SPOT_LIGHTS ];\nvarying vec4 vSpotLight[ MAX_SPOT_LIGHTS ];\n#endif\n#endif\n#if MAX_SPOT_LIGHTS > 0 || defined( USE_BUMPMAP )\nvarying vec3 vWorldPosition;\n#endif",
  lights_phong_vertex:
    "#ifndef PHONG_PER_PIXEL\n#if MAX_POINT_LIGHTS > 0\nfor( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {\nvec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );\nvec3 lVector = lPosition.xyz - mvPosition.xyz;\nfloat lDistance = 1.0;\nif ( pointLightDistance[ i ] > 0.0 )\nlDistance = 1.0 - min( ( length( lVector ) / pointLightDistance[ i ] ), 1.0 );\nvPointLight[ i ] = vec4( lVector, lDistance );\n}\n#endif\n#if MAX_SPOT_LIGHTS > 0\nfor( int i = 0; i < MAX_SPOT_LIGHTS; i ++ ) {\nvec4 lPosition = viewMatrix * vec4( spotLightPosition[ i ], 1.0 );\nvec3 lVector = lPosition.xyz - mvPosition.xyz;\nfloat lDistance = 1.0;\nif ( spotLightDistance[ i ] > 0.0 )\nlDistance = 1.0 - min( ( length( lVector ) / spotLightDistance[ i ] ), 1.0 );\nvSpotLight[ i ] = vec4( lVector, lDistance );\n}\n#endif\n#endif\n#if MAX_SPOT_LIGHTS > 0 || defined( USE_BUMPMAP )\nvWorldPosition = worldPosition.xyz;\n#endif",
  lights_phong_pars_fragment:
    "uniform vec3 ambientLightColor;\n#if MAX_DIR_LIGHTS > 0\nuniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];\nuniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];\n#endif\n#if MAX_HEMI_LIGHTS > 0\nuniform vec3 hemisphereLightSkyColor[ MAX_HEMI_LIGHTS ];\nuniform vec3 hemisphereLightGroundColor[ MAX_HEMI_LIGHTS ];\nuniform vec3 hemisphereLightDirection[ MAX_HEMI_LIGHTS ];\n#endif\n#if MAX_POINT_LIGHTS > 0\nuniform vec3 pointLightColor[ MAX_POINT_LIGHTS ];\n#ifdef PHONG_PER_PIXEL\nuniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];\nuniform float pointLightDistance[ MAX_POINT_LIGHTS ];\n#else\nvarying vec4 vPointLight[ MAX_POINT_LIGHTS ];\n#endif\n#endif\n#if MAX_SPOT_LIGHTS > 0\nuniform vec3 spotLightColor[ MAX_SPOT_LIGHTS ];\nuniform vec3 spotLightPosition[ MAX_SPOT_LIGHTS ];\nuniform vec3 spotLightDirection[ MAX_SPOT_LIGHTS ];\nuniform float spotLightAngleCos[ MAX_SPOT_LIGHTS ];\nuniform float spotLightExponent[ MAX_SPOT_LIGHTS ];\n#ifdef PHONG_PER_PIXEL\nuniform float spotLightDistance[ MAX_SPOT_LIGHTS ];\n#else\nvarying vec4 vSpotLight[ MAX_SPOT_LIGHTS ];\n#endif\n#endif\n#if MAX_SPOT_LIGHTS > 0 || defined( USE_BUMPMAP )\nvarying vec3 vWorldPosition;\n#endif\n#ifdef WRAP_AROUND\nuniform vec3 wrapRGB;\n#endif\nvarying vec3 vViewPosition;\nvarying vec3 vNormal;",
  lights_phong_fragment:
    "vec3 normal = normalize( vNormal );\nvec3 viewPosition = normalize( vViewPosition );\n#ifdef DOUBLE_SIDED\nnormal = normal * ( -1.0 + 2.0 * float( gl_FrontFacing ) );\n#endif\n#ifdef USE_NORMALMAP\nnormal = perturbNormal2Arb( -vViewPosition, normal );\n#elif defined( USE_BUMPMAP )\nnormal = perturbNormalArb( -vViewPosition, normal, dHdxy_fwd() );\n#endif\n#if MAX_POINT_LIGHTS > 0\nvec3 pointDiffuse  = vec3( 0.0 );\nvec3 pointSpecular = vec3( 0.0 );\nfor ( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {\n#ifdef PHONG_PER_PIXEL\nvec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );\nvec3 lVector = lPosition.xyz + vViewPosition.xyz;\nfloat lDistance = 1.0;\nif ( pointLightDistance[ i ] > 0.0 )\nlDistance = 1.0 - min( ( length( lVector ) / pointLightDistance[ i ] ), 1.0 );\nlVector = normalize( lVector );\n#else\nvec3 lVector = normalize( vPointLight[ i ].xyz );\nfloat lDistance = vPointLight[ i ].w;\n#endif\nfloat dotProduct = dot( normal, lVector );\n#ifdef WRAP_AROUND\nfloat pointDiffuseWeightFull = max( dotProduct, 0.0 );\nfloat pointDiffuseWeightHalf = max( 0.5 * dotProduct + 0.5, 0.0 );\nvec3 pointDiffuseWeight = mix( vec3 ( pointDiffuseWeightFull ), vec3( pointDiffuseWeightHalf ), wrapRGB );\n#else\nfloat pointDiffuseWeight = max( dotProduct, 0.0 );\n#endif\npointDiffuse  += diffuse * pointLightColor[ i ] * pointDiffuseWeight * lDistance;\nvec3 pointHalfVector = normalize( lVector + viewPosition );\nfloat pointDotNormalHalf = max( dot( normal, pointHalfVector ), 0.0 );\nfloat pointSpecularWeight = specularStrength * max( pow( pointDotNormalHalf, shininess ), 0.0 );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat specularNormalization = ( shininess + 2.0001 ) / 8.0;\nvec3 schlick = specular + vec3( 1.0 - specular ) * pow( 1.0 - dot( lVector, pointHalfVector ), 5.0 );\npointSpecular += schlick * pointLightColor[ i ] * pointSpecularWeight * pointDiffuseWeight * lDistance * specularNormalization;\n#else\npointSpecular += specular * pointLightColor[ i ] * pointSpecularWeight * pointDiffuseWeight * lDistance;\n#endif\n}\n#endif\n#if MAX_SPOT_LIGHTS > 0\nvec3 spotDiffuse  = vec3( 0.0 );\nvec3 spotSpecular = vec3( 0.0 );\nfor ( int i = 0; i < MAX_SPOT_LIGHTS; i ++ ) {\n#ifdef PHONG_PER_PIXEL\nvec4 lPosition = viewMatrix * vec4( spotLightPosition[ i ], 1.0 );\nvec3 lVector = lPosition.xyz + vViewPosition.xyz;\nfloat lDistance = 1.0;\nif ( spotLightDistance[ i ] > 0.0 )\nlDistance = 1.0 - min( ( length( lVector ) / spotLightDistance[ i ] ), 1.0 );\nlVector = normalize( lVector );\n#else\nvec3 lVector = normalize( vSpotLight[ i ].xyz );\nfloat lDistance = vSpotLight[ i ].w;\n#endif\nfloat spotEffect = dot( spotLightDirection[ i ], normalize( spotLightPosition[ i ] - vWorldPosition ) );\nif ( spotEffect > spotLightAngleCos[ i ] ) {\nspotEffect = max( pow( spotEffect, spotLightExponent[ i ] ), 0.0 );\nfloat dotProduct = dot( normal, lVector );\n#ifdef WRAP_AROUND\nfloat spotDiffuseWeightFull = max( dotProduct, 0.0 );\nfloat spotDiffuseWeightHalf = max( 0.5 * dotProduct + 0.5, 0.0 );\nvec3 spotDiffuseWeight = mix( vec3 ( spotDiffuseWeightFull ), vec3( spotDiffuseWeightHalf ), wrapRGB );\n#else\nfloat spotDiffuseWeight = max( dotProduct, 0.0 );\n#endif\nspotDiffuse += diffuse * spotLightColor[ i ] * spotDiffuseWeight * lDistance * spotEffect;\nvec3 spotHalfVector = normalize( lVector + viewPosition );\nfloat spotDotNormalHalf = max( dot( normal, spotHalfVector ), 0.0 );\nfloat spotSpecularWeight = specularStrength * max( pow( spotDotNormalHalf, shininess ), 0.0 );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat specularNormalization = ( shininess + 2.0001 ) / 8.0;\nvec3 schlick = specular + vec3( 1.0 - specular ) * pow( 1.0 - dot( lVector, spotHalfVector ), 5.0 );\nspotSpecular += schlick * spotLightColor[ i ] * spotSpecularWeight * spotDiffuseWeight * lDistance * specularNormalization * spotEffect;\n#else\nspotSpecular += specular * spotLightColor[ i ] * spotSpecularWeight * spotDiffuseWeight * lDistance * spotEffect;\n#endif\n}\n}\n#endif\n#if MAX_DIR_LIGHTS > 0\nvec3 dirDiffuse  = vec3( 0.0 );\nvec3 dirSpecular = vec3( 0.0 );\nfor( int i = 0; i < MAX_DIR_LIGHTS; i ++ ) {\nvec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );\nvec3 dirVector = normalize( lDirection.xyz );\nfloat dotProduct = dot( normal, dirVector );\n#ifdef WRAP_AROUND\nfloat dirDiffuseWeightFull = max( dotProduct, 0.0 );\nfloat dirDiffuseWeightHalf = max( 0.5 * dotProduct + 0.5, 0.0 );\nvec3 dirDiffuseWeight = mix( vec3( dirDiffuseWeightFull ), vec3( dirDiffuseWeightHalf ), wrapRGB );\n#else\nfloat dirDiffuseWeight = max( dotProduct, 0.0 );\n#endif\ndirDiffuse  += diffuse * directionalLightColor[ i ] * dirDiffuseWeight;\nvec3 dirHalfVector = normalize( dirVector + viewPosition );\nfloat dirDotNormalHalf = max( dot( normal, dirHalfVector ), 0.0 );\nfloat dirSpecularWeight = specularStrength * max( pow( dirDotNormalHalf, shininess ), 0.0 );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat specularNormalization = ( shininess + 2.0001 ) / 8.0;\nvec3 schlick = specular + vec3( 1.0 - specular ) * pow( 1.0 - dot( dirVector, dirHalfVector ), 5.0 );\ndirSpecular += schlick * directionalLightColor[ i ] * dirSpecularWeight * dirDiffuseWeight * specularNormalization;\n#else\ndirSpecular += specular * directionalLightColor[ i ] * dirSpecularWeight * dirDiffuseWeight;\n#endif\n}\n#endif\n#if MAX_HEMI_LIGHTS > 0\nvec3 hemiDiffuse  = vec3( 0.0 );\nvec3 hemiSpecular = vec3( 0.0 );\nfor( int i = 0; i < MAX_HEMI_LIGHTS; i ++ ) {\nvec4 lDirection = viewMatrix * vec4( hemisphereLightDirection[ i ], 0.0 );\nvec3 lVector = normalize( lDirection.xyz );\nfloat dotProduct = dot( normal, lVector );\nfloat hemiDiffuseWeight = 0.5 * dotProduct + 0.5;\nvec3 hemiColor = mix( hemisphereLightGroundColor[ i ], hemisphereLightSkyColor[ i ], hemiDiffuseWeight );\nhemiDiffuse += diffuse * hemiColor;\nvec3 hemiHalfVectorSky = normalize( lVector + viewPosition );\nfloat hemiDotNormalHalfSky = 0.5 * dot( normal, hemiHalfVectorSky ) + 0.5;\nfloat hemiSpecularWeightSky = specularStrength * max( pow( hemiDotNormalHalfSky, shininess ), 0.0 );\nvec3 lVectorGround = -lVector;\nvec3 hemiHalfVectorGround = normalize( lVectorGround + viewPosition );\nfloat hemiDotNormalHalfGround = 0.5 * dot( normal, hemiHalfVectorGround ) + 0.5;\nfloat hemiSpecularWeightGround = specularStrength * max( pow( hemiDotNormalHalfGround, shininess ), 0.0 );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat dotProductGround = dot( normal, lVectorGround );\nfloat specularNormalization = ( shininess + 2.0001 ) / 8.0;\nvec3 schlickSky = specular + vec3( 1.0 - specular ) * pow( 1.0 - dot( lVector, hemiHalfVectorSky ), 5.0 );\nvec3 schlickGround = specular + vec3( 1.0 - specular ) * pow( 1.0 - dot( lVectorGround, hemiHalfVectorGround ), 5.0 );\nhemiSpecular += hemiColor * specularNormalization * ( schlickSky * hemiSpecularWeightSky * max( dotProduct, 0.0 ) + schlickGround * hemiSpecularWeightGround * max( dotProductGround, 0.0 ) );\n#else\nhemiSpecular += specular * hemiColor * ( hemiSpecularWeightSky + hemiSpecularWeightGround ) * hemiDiffuseWeight;\n#endif\n}\n#endif\nvec3 totalDiffuse = vec3( 0.0 );\nvec3 totalSpecular = vec3( 0.0 );\n#if MAX_DIR_LIGHTS > 0\ntotalDiffuse += dirDiffuse;\ntotalSpecular += dirSpecular;\n#endif\n#if MAX_HEMI_LIGHTS > 0\ntotalDiffuse += hemiDiffuse;\ntotalSpecular += hemiSpecular;\n#endif\n#if MAX_POINT_LIGHTS > 0\ntotalDiffuse += pointDiffuse;\ntotalSpecular += pointSpecular;\n#endif\n#if MAX_SPOT_LIGHTS > 0\ntotalDiffuse += spotDiffuse;\ntotalSpecular += spotSpecular;\n#endif\n#ifdef METAL\ngl_FragColor.xyz = gl_FragColor.xyz * ( emissive + totalDiffuse + ambientLightColor * ambient + totalSpecular );\n#else\ngl_FragColor.xyz = gl_FragColor.xyz * ( emissive + totalDiffuse + ambientLightColor * ambient ) + totalSpecular;\n#endif",
  color_pars_fragment: "#ifdef USE_COLOR\nvarying vec3 vColor;\n#endif",
  color_fragment:
    "#ifdef USE_COLOR\ngl_FragColor = gl_FragColor * vec4( vColor, opacity );\n#endif",
  color_pars_vertex: "#ifdef USE_COLOR\nvarying vec3 vColor;\n#endif",
  color_vertex:
    "#ifdef USE_COLOR\n#ifdef GAMMA_INPUT\nvColor = color * color;\n#else\nvColor = color;\n#endif\n#endif",
  skinning_pars_vertex:
    "#ifdef USE_SKINNING\n#ifdef BONE_TEXTURE\nuniform sampler2D boneTexture;\nmat4 getBoneMatrix( const in float i ) {\nfloat j = i * 4.0;\nfloat x = mod( j, N_BONE_PIXEL_X );\nfloat y = floor( j / N_BONE_PIXEL_X );\nconst float dx = 1.0 / N_BONE_PIXEL_X;\nconst float dy = 1.0 / N_BONE_PIXEL_Y;\ny = dy * ( y + 0.5 );\nvec4 v1 = texture2D( boneTexture, vec2( dx * ( x + 0.5 ), y ) );\nvec4 v2 = texture2D( boneTexture, vec2( dx * ( x + 1.5 ), y ) );\nvec4 v3 = texture2D( boneTexture, vec2( dx * ( x + 2.5 ), y ) );\nvec4 v4 = texture2D( boneTexture, vec2( dx * ( x + 3.5 ), y ) );\nmat4 bone = mat4( v1, v2, v3, v4 );\nreturn bone;\n}\n#else\nuniform mat4 boneGlobalMatrices[ MAX_BONES ];\nmat4 getBoneMatrix( const in float i ) {\nmat4 bone = boneGlobalMatrices[ int(i) ];\nreturn bone;\n}\n#endif\n#endif",
  skinbase_vertex:
    "#ifdef USE_SKINNING\nmat4 boneMatX = getBoneMatrix( skinIndex.x );\nmat4 boneMatY = getBoneMatrix( skinIndex.y );\n#endif",
  skinning_vertex:
    "#ifdef USE_SKINNING\n#ifdef USE_MORPHTARGETS\nvec4 skinVertex = vec4( morphed, 1.0 );\n#else\nvec4 skinVertex = vec4( position, 1.0 );\n#endif\nvec4 skinned  = boneMatX * skinVertex * skinWeight.x;\nskinned \t  += boneMatY * skinVertex * skinWeight.y;\n#endif",
  morphtarget_pars_vertex:
    "#ifdef USE_MORPHTARGETS\n#ifndef USE_MORPHNORMALS\nuniform float morphTargetInfluences[ 8 ];\n#else\nuniform float morphTargetInfluences[ 4 ];\n#endif\n#endif",
  morphtarget_vertex:
    "#ifdef USE_MORPHTARGETS\nvec3 morphed = vec3( 0.0 );\nmorphed += ( morphTarget0 - position ) * morphTargetInfluences[ 0 ];\nmorphed += ( morphTarget1 - position ) * morphTargetInfluences[ 1 ];\nmorphed += ( morphTarget2 - position ) * morphTargetInfluences[ 2 ];\nmorphed += ( morphTarget3 - position ) * morphTargetInfluences[ 3 ];\n#ifndef USE_MORPHNORMALS\nmorphed += ( morphTarget4 - position ) * morphTargetInfluences[ 4 ];\nmorphed += ( morphTarget5 - position ) * morphTargetInfluences[ 5 ];\nmorphed += ( morphTarget6 - position ) * morphTargetInfluences[ 6 ];\nmorphed += ( morphTarget7 - position ) * morphTargetInfluences[ 7 ];\n#endif\nmorphed += position;\n#endif",
  default_vertex:
    "vec4 mvPosition;\n#ifdef USE_SKINNING\nmvPosition = modelViewMatrix * skinned;\n#endif\n#if !defined( USE_SKINNING ) && defined( USE_MORPHTARGETS )\nmvPosition = modelViewMatrix * vec4( morphed, 1.0 );\n#endif\n#if !defined( USE_SKINNING ) && ! defined( USE_MORPHTARGETS )\nmvPosition = modelViewMatrix * vec4( position, 1.0 );\n#endif\ngl_Position = projectionMatrix * mvPosition;",
  morphnormal_vertex:
    "#ifdef USE_MORPHNORMALS\nvec3 morphedNormal = vec3( 0.0 );\nmorphedNormal +=  ( morphNormal0 - normal ) * morphTargetInfluences[ 0 ];\nmorphedNormal +=  ( morphNormal1 - normal ) * morphTargetInfluences[ 1 ];\nmorphedNormal +=  ( morphNormal2 - normal ) * morphTargetInfluences[ 2 ];\nmorphedNormal +=  ( morphNormal3 - normal ) * morphTargetInfluences[ 3 ];\nmorphedNormal += normal;\n#endif",
  skinnormal_vertex:
    "#ifdef USE_SKINNING\nmat4 skinMatrix = skinWeight.x * boneMatX;\nskinMatrix \t+= skinWeight.y * boneMatY;\n#ifdef USE_MORPHNORMALS\nvec4 skinnedNormal = skinMatrix * vec4( morphedNormal, 0.0 );\n#else\nvec4 skinnedNormal = skinMatrix * vec4( normal, 0.0 );\n#endif\n#endif",
  defaultnormal_vertex:
    "vec3 objectNormal;\n#ifdef USE_SKINNING\nobjectNormal = skinnedNormal.xyz;\n#endif\n#if !defined( USE_SKINNING ) && defined( USE_MORPHNORMALS )\nobjectNormal = morphedNormal;\n#endif\n#if !defined( USE_SKINNING ) && ! defined( USE_MORPHNORMALS )\nobjectNormal = normal;\n#endif\n#ifdef FLIP_SIDED\nobjectNormal = -objectNormal;\n#endif\nvec3 transformedNormal = normalMatrix * objectNormal;",
  shadowmap_pars_fragment:
    "#ifdef USE_SHADOWMAP\nuniform sampler2D shadowMap[ MAX_SHADOWS ];\nuniform vec2 shadowMapSize[ MAX_SHADOWS ];\nuniform float shadowDarkness[ MAX_SHADOWS ];\nuniform float shadowBias[ MAX_SHADOWS ];\nvarying vec4 vShadowCoord[ MAX_SHADOWS ];\nfloat unpackDepth( const in vec4 rgba_depth ) {\nconst vec4 bit_shift = vec4( 1.0 / ( 256.0 * 256.0 * 256.0 ), 1.0 / ( 256.0 * 256.0 ), 1.0 / 256.0, 1.0 );\nfloat depth = dot( rgba_depth, bit_shift );\nreturn depth;\n}\n#endif",
  shadowmap_fragment:
    "#ifdef USE_SHADOWMAP\n#ifdef SHADOWMAP_DEBUG\nvec3 frustumColors[3];\nfrustumColors[0] = vec3( 1.0, 0.5, 0.0 );\nfrustumColors[1] = vec3( 0.0, 1.0, 0.8 );\nfrustumColors[2] = vec3( 0.0, 0.5, 1.0 );\n#endif\n#ifdef SHADOWMAP_CASCADE\nint inFrustumCount = 0;\n#endif\nfloat fDepth;\nvec3 shadowColor = vec3( 1.0 );\nfor( int i = 0; i < MAX_SHADOWS; i ++ ) {\nvec3 shadowCoord = vShadowCoord[ i ].xyz / vShadowCoord[ i ].w;\nbvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );\nbool inFrustum = all( inFrustumVec );\n#ifdef SHADOWMAP_CASCADE\ninFrustumCount += int( inFrustum );\nbvec3 frustumTestVec = bvec3( inFrustum, inFrustumCount == 1, shadowCoord.z <= 1.0 );\n#else\nbvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );\n#endif\nbool frustumTest = all( frustumTestVec );\nif ( frustumTest ) {\nshadowCoord.z += shadowBias[ i ];\n#if defined( SHADOWMAP_TYPE_PCF )\nfloat shadow = 0.0;\nconst float shadowDelta = 1.0 / 9.0;\nfloat xPixelOffset = 1.0 / shadowMapSize[ i ].x;\nfloat yPixelOffset = 1.0 / shadowMapSize[ i ].y;\nfloat dx0 = -1.25 * xPixelOffset;\nfloat dy0 = -1.25 * yPixelOffset;\nfloat dx1 = 1.25 * xPixelOffset;\nfloat dy1 = 1.25 * yPixelOffset;\nfDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy0 ) ) );\nif ( fDepth < shadowCoord.z ) shadow += shadowDelta;\nfDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy0 ) ) );\nif ( fDepth < shadowCoord.z ) shadow += shadowDelta;\nfDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy0 ) ) );\nif ( fDepth < shadowCoord.z ) shadow += shadowDelta;\nfDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, 0.0 ) ) );\nif ( fDepth < shadowCoord.z ) shadow += shadowDelta;\nfDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy ) );\nif ( fDepth < shadowCoord.z ) shadow += shadowDelta;\nfDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, 0.0 ) ) );\nif ( fDepth < shadowCoord.z ) shadow += shadowDelta;\nfDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy1 ) ) );\nif ( fDepth < shadowCoord.z ) shadow += shadowDelta;\nfDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy1 ) ) );\nif ( fDepth < shadowCoord.z ) shadow += shadowDelta;\nfDepth = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy1 ) ) );\nif ( fDepth < shadowCoord.z ) shadow += shadowDelta;\nshadowColor = shadowColor * vec3( ( 1.0 - shadowDarkness[ i ] * shadow ) );\n#elif defined( SHADOWMAP_TYPE_PCF_SOFT )\nfloat shadow = 0.0;\nfloat xPixelOffset = 1.0 / shadowMapSize[ i ].x;\nfloat yPixelOffset = 1.0 / shadowMapSize[ i ].y;\nfloat dx0 = -1.0 * xPixelOffset;\nfloat dy0 = -1.0 * yPixelOffset;\nfloat dx1 = 1.0 * xPixelOffset;\nfloat dy1 = 1.0 * yPixelOffset;\nmat3 shadowKernel;\nmat3 depthKernel;\ndepthKernel[0][0] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy0 ) ) );\ndepthKernel[0][1] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, 0.0 ) ) );\ndepthKernel[0][2] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx0, dy1 ) ) );\ndepthKernel[1][0] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy0 ) ) );\ndepthKernel[1][1] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy ) );\ndepthKernel[1][2] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( 0.0, dy1 ) ) );\ndepthKernel[2][0] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy0 ) ) );\ndepthKernel[2][1] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, 0.0 ) ) );\ndepthKernel[2][2] = unpackDepth( texture2D( shadowMap[ i ], shadowCoord.xy + vec2( dx1, dy1 ) ) );\nvec3 shadowZ = vec3( shadowCoord.z );\nshadowKernel[0] = vec3(lessThan(depthKernel[0], shadowZ ));\nshadowKernel[0] *= vec3(0.25);\nshadowKernel[1] = vec3(lessThan(depthKernel[1], shadowZ ));\nshadowKernel[1] *= vec3(0.25);\nshadowKernel[2] = vec3(lessThan(depthKernel[2], shadowZ ));\nshadowKernel[2] *= vec3(0.25);\nvec2 fractionalCoord = 1.0 - fract( shadowCoord.xy * shadowMapSize[i].xy );\nshadowKernel[0] = mix( shadowKernel[1], shadowKernel[0], fractionalCoord.x );\nshadowKernel[1] = mix( shadowKernel[2], shadowKernel[1], fractionalCoord.x );\nvec4 shadowValues;\nshadowValues.x = mix( shadowKernel[0][1], shadowKernel[0][0], fractionalCoord.y );\nshadowValues.y = mix( shadowKernel[0][2], shadowKernel[0][1], fractionalCoord.y );\nshadowValues.z = mix( shadowKernel[1][1], shadowKernel[1][0], fractionalCoord.y );\nshadowValues.w = mix( shadowKernel[1][2], shadowKernel[1][1], fractionalCoord.y );\nshadow = dot( shadowValues, vec4( 1.0 ) );\nshadowColor = shadowColor * vec3( ( 1.0 - shadowDarkness[ i ] * shadow ) );\n#else\nvec4 rgbaDepth = texture2D( shadowMap[ i ], shadowCoord.xy );\nfloat fDepth = unpackDepth( rgbaDepth );\nif ( fDepth < shadowCoord.z )\nshadowColor = shadowColor * vec3( 1.0 - shadowDarkness[ i ] );\n#endif\n}\n#ifdef SHADOWMAP_DEBUG\n#ifdef SHADOWMAP_CASCADE\nif ( inFrustum && inFrustumCount == 1 ) gl_FragColor.xyz *= frustumColors[ i ];\n#else\nif ( inFrustum ) gl_FragColor.xyz *= frustumColors[ i ];\n#endif\n#endif\n}\n#ifdef GAMMA_OUTPUT\nshadowColor *= shadowColor;\n#endif\ngl_FragColor.xyz = gl_FragColor.xyz * shadowColor;\n#endif",
  shadowmap_pars_vertex:
    "#ifdef USE_SHADOWMAP\nvarying vec4 vShadowCoord[ MAX_SHADOWS ];\nuniform mat4 shadowMatrix[ MAX_SHADOWS ];\n#endif",
  shadowmap_vertex:
    "#ifdef USE_SHADOWMAP\nfor( int i = 0; i < MAX_SHADOWS; i ++ ) {\nvShadowCoord[ i ] = shadowMatrix[ i ] * worldPosition;\n}\n#endif",
  alphatest_fragment:
    "#ifdef ALPHATEST\nif ( gl_FragColor.a < ALPHATEST ) discard;\n#endif",
  linear_to_gamma_fragment:
    "#ifdef GAMMA_OUTPUT\ngl_FragColor.xyz = sqrt( gl_FragColor.xyz );\n#endif",
};
THREE.UniformsUtils = {
  merge: function (a) {
    var b,
      c,
      d,
      e = {};
    for (b = 0; b < a.length; b++)
      for (c in ((d = this.clone(a[b])), d)) e[c] = d[c];
    return e;
  },
  clone: function (a) {
    var b,
      c,
      d,
      e = {};
    for (b in a)
      for (c in ((e[b] = {}), a[b]))
        (d = a[b][c]),
          (e[b][c] =
            d instanceof THREE.Color ||
            d instanceof THREE.Vector2 ||
            d instanceof THREE.Vector3 ||
            d instanceof THREE.Vector4 ||
            d instanceof THREE.Matrix4 ||
            d instanceof THREE.Texture
              ? d.clone()
              : d instanceof Array
              ? d.slice()
              : d);
    return e;
  },
};
THREE.UniformsLib = {
  common: {
    diffuse: { type: "c", value: new THREE.Color(15658734) },
    opacity: { type: "f", value: 1 },
    map: { type: "t", value: null },
    offsetRepeat: { type: "v4", value: new THREE.Vector4(0, 0, 1, 1) },
    lightMap: { type: "t", value: null },
    specularMap: { type: "t", value: null },
    envMap: { type: "t", value: null },
    flipEnvMap: { type: "f", value: -1 },
    useRefract: { type: "i", value: 0 },
    reflectivity: { type: "f", value: 1 },
    refractionRatio: { type: "f", value: 0.98 },
    combine: { type: "i", value: 0 },
    morphTargetInfluences: { type: "f", value: 0 },
  },
  bump: {
    bumpMap: { type: "t", value: null },
    bumpScale: { type: "f", value: 1 },
  },
  normalmap: {
    normalMap: { type: "t", value: null },
    normalScale: { type: "v2", value: new THREE.Vector2(1, 1) },
  },
  fog: {
    fogDensity: { type: "f", value: 2.5e-4 },
    fogNear: { type: "f", value: 1 },
    fogFar: { type: "f", value: 2e3 },
    fogColor: { type: "c", value: new THREE.Color(16777215) },
  },
  lights: {
    ambientLightColor: { type: "fv", value: [] },
    directionalLightDirection: { type: "fv", value: [] },
    directionalLightColor: { type: "fv", value: [] },
    hemisphereLightDirection: { type: "fv", value: [] },
    hemisphereLightSkyColor: { type: "fv", value: [] },
    hemisphereLightGroundColor: { type: "fv", value: [] },
    pointLightColor: { type: "fv", value: [] },
    pointLightPosition: { type: "fv", value: [] },
    pointLightDistance: { type: "fv1", value: [] },
    spotLightColor: { type: "fv", value: [] },
    spotLightPosition: { type: "fv", value: [] },
    spotLightDirection: { type: "fv", value: [] },
    spotLightDistance: { type: "fv1", value: [] },
    spotLightAngleCos: { type: "fv1", value: [] },
    spotLightExponent: { type: "fv1", value: [] },
  },
  particle: {
    psColor: { type: "c", value: new THREE.Color(15658734) },
    opacity: { type: "f", value: 1 },
    size: { type: "f", value: 1 },
    scale: { type: "f", value: 1 },
    map: { type: "t", value: null },
    fogDensity: { type: "f", value: 2.5e-4 },
    fogNear: { type: "f", value: 1 },
    fogFar: { type: "f", value: 2e3 },
    fogColor: { type: "c", value: new THREE.Color(16777215) },
  },
  shadowmap: {
    shadowMap: { type: "tv", value: [] },
    shadowMapSize: { type: "v2v", value: [] },
    shadowBias: { type: "fv1", value: [] },
    shadowDarkness: { type: "fv1", value: [] },
    shadowMatrix: { type: "m4v", value: [] },
  },
};
THREE.ShaderLib = {
  basic: {
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.common,
      THREE.UniformsLib.fog,
      THREE.UniformsLib.shadowmap,
    ]),
    vertexShader: [
      THREE.ShaderChunk.map_pars_vertex,
      THREE.ShaderChunk.lightmap_pars_vertex,
      THREE.ShaderChunk.envmap_pars_vertex,
      THREE.ShaderChunk.color_pars_vertex,
      THREE.ShaderChunk.morphtarget_pars_vertex,
      THREE.ShaderChunk.skinning_pars_vertex,
      THREE.ShaderChunk.shadowmap_pars_vertex,
      "void main() {",
      THREE.ShaderChunk.map_vertex,
      THREE.ShaderChunk.lightmap_vertex,
      THREE.ShaderChunk.color_vertex,
      THREE.ShaderChunk.skinbase_vertex,
      "#ifdef USE_ENVMAP",
      THREE.ShaderChunk.morphnormal_vertex,
      THREE.ShaderChunk.skinnormal_vertex,
      THREE.ShaderChunk.defaultnormal_vertex,
      "#endif",
      THREE.ShaderChunk.morphtarget_vertex,
      THREE.ShaderChunk.skinning_vertex,
      THREE.ShaderChunk.default_vertex,
      THREE.ShaderChunk.worldpos_vertex,
      THREE.ShaderChunk.envmap_vertex,
      THREE.ShaderChunk.shadowmap_vertex,
      "}",
    ].join("\n"),
    fragmentShader: [
      "uniform vec3 diffuse;\nuniform float opacity;",
      THREE.ShaderChunk.color_pars_fragment,
      THREE.ShaderChunk.map_pars_fragment,
      THREE.ShaderChunk.lightmap_pars_fragment,
      THREE.ShaderChunk.envmap_pars_fragment,
      THREE.ShaderChunk.fog_pars_fragment,
      THREE.ShaderChunk.shadowmap_pars_fragment,
      THREE.ShaderChunk.specularmap_pars_fragment,
      "void main() {\ngl_FragColor = vec4( diffuse, opacity );",
      THREE.ShaderChunk.map_fragment,
      THREE.ShaderChunk.alphatest_fragment,
      THREE.ShaderChunk.specularmap_fragment,
      THREE.ShaderChunk.lightmap_fragment,
      THREE.ShaderChunk.color_fragment,
      THREE.ShaderChunk.envmap_fragment,
      THREE.ShaderChunk.shadowmap_fragment,
      THREE.ShaderChunk.linear_to_gamma_fragment,
      THREE.ShaderChunk.fog_fragment,
      "}",
    ].join("\n"),
  },
  lambert: {
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.common,
      THREE.UniformsLib.fog,
      THREE.UniformsLib.lights,
      THREE.UniformsLib.shadowmap,
      {
        ambient: { type: "c", value: new THREE.Color(16777215) },
        emissive: { type: "c", value: new THREE.Color(0) },
        wrapRGB: { type: "v3", value: new THREE.Vector3(1, 1, 1) },
      },
    ]),
    vertexShader: [
      "#define LAMBERT\nvarying vec3 vLightFront;\n#ifdef DOUBLE_SIDED\nvarying vec3 vLightBack;\n#endif",
      THREE.ShaderChunk.map_pars_vertex,
      THREE.ShaderChunk.lightmap_pars_vertex,
      THREE.ShaderChunk.envmap_pars_vertex,
      THREE.ShaderChunk.lights_lambert_pars_vertex,
      THREE.ShaderChunk.color_pars_vertex,
      THREE.ShaderChunk.morphtarget_pars_vertex,
      THREE.ShaderChunk.skinning_pars_vertex,
      THREE.ShaderChunk.shadowmap_pars_vertex,
      "void main() {",
      THREE.ShaderChunk.map_vertex,
      THREE.ShaderChunk.lightmap_vertex,
      THREE.ShaderChunk.color_vertex,
      THREE.ShaderChunk.morphnormal_vertex,
      THREE.ShaderChunk.skinbase_vertex,
      THREE.ShaderChunk.skinnormal_vertex,
      THREE.ShaderChunk.defaultnormal_vertex,
      THREE.ShaderChunk.morphtarget_vertex,
      THREE.ShaderChunk.skinning_vertex,
      THREE.ShaderChunk.default_vertex,
      THREE.ShaderChunk.worldpos_vertex,
      THREE.ShaderChunk.envmap_vertex,
      THREE.ShaderChunk.lights_lambert_vertex,
      THREE.ShaderChunk.shadowmap_vertex,
      "}",
    ].join("\n"),
    fragmentShader: [
      "uniform float opacity;\nvarying vec3 vLightFront;\n#ifdef DOUBLE_SIDED\nvarying vec3 vLightBack;\n#endif",
      THREE.ShaderChunk.color_pars_fragment,
      THREE.ShaderChunk.map_pars_fragment,
      THREE.ShaderChunk.lightmap_pars_fragment,
      THREE.ShaderChunk.envmap_pars_fragment,
      THREE.ShaderChunk.fog_pars_fragment,
      THREE.ShaderChunk.shadowmap_pars_fragment,
      THREE.ShaderChunk.specularmap_pars_fragment,
      "void main() {\ngl_FragColor = vec4( vec3 ( 1.0 ), opacity );",
      THREE.ShaderChunk.map_fragment,
      THREE.ShaderChunk.alphatest_fragment,
      THREE.ShaderChunk.specularmap_fragment,
      "#ifdef DOUBLE_SIDED\nif ( gl_FrontFacing )\ngl_FragColor.xyz *= vLightFront;\nelse\ngl_FragColor.xyz *= vLightBack;\n#else\ngl_FragColor.xyz *= vLightFront;\n#endif",
      THREE.ShaderChunk.lightmap_fragment,
      THREE.ShaderChunk.color_fragment,
      THREE.ShaderChunk.envmap_fragment,
      THREE.ShaderChunk.shadowmap_fragment,
      THREE.ShaderChunk.linear_to_gamma_fragment,
      THREE.ShaderChunk.fog_fragment,
      "}",
    ].join("\n"),
  },
  phong: {
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.common,
      THREE.UniformsLib.bump,
      THREE.UniformsLib.normalmap,
      THREE.UniformsLib.fog,
      THREE.UniformsLib.lights,
      THREE.UniformsLib.shadowmap,
      {
        ambient: { type: "c", value: new THREE.Color(16777215) },
        emissive: { type: "c", value: new THREE.Color(0) },
        specular: { type: "c", value: new THREE.Color(1118481) },
        shininess: { type: "f", value: 30 },
        wrapRGB: { type: "v3", value: new THREE.Vector3(1, 1, 1) },
      },
    ]),
    vertexShader: [
      "#define PHONG\nvarying vec3 vViewPosition;\nvarying vec3 vNormal;",
      THREE.ShaderChunk.map_pars_vertex,
      THREE.ShaderChunk.lightmap_pars_vertex,
      THREE.ShaderChunk.envmap_pars_vertex,
      THREE.ShaderChunk.lights_phong_pars_vertex,
      THREE.ShaderChunk.color_pars_vertex,
      THREE.ShaderChunk.morphtarget_pars_vertex,
      THREE.ShaderChunk.skinning_pars_vertex,
      THREE.ShaderChunk.shadowmap_pars_vertex,
      "void main() {",
      THREE.ShaderChunk.map_vertex,
      THREE.ShaderChunk.lightmap_vertex,
      THREE.ShaderChunk.color_vertex,
      THREE.ShaderChunk.morphnormal_vertex,
      THREE.ShaderChunk.skinbase_vertex,
      THREE.ShaderChunk.skinnormal_vertex,
      THREE.ShaderChunk.defaultnormal_vertex,
      "vNormal = normalize( transformedNormal );",
      THREE.ShaderChunk.morphtarget_vertex,
      THREE.ShaderChunk.skinning_vertex,
      THREE.ShaderChunk.default_vertex,
      "vViewPosition = -mvPosition.xyz;",
      THREE.ShaderChunk.worldpos_vertex,
      THREE.ShaderChunk.envmap_vertex,
      THREE.ShaderChunk.lights_phong_vertex,
      THREE.ShaderChunk.shadowmap_vertex,
      "}",
    ].join("\n"),
    fragmentShader: [
      "uniform vec3 diffuse;\nuniform float opacity;\nuniform vec3 ambient;\nuniform vec3 emissive;\nuniform vec3 specular;\nuniform float shininess;",
      THREE.ShaderChunk.color_pars_fragment,
      THREE.ShaderChunk.map_pars_fragment,
      THREE.ShaderChunk.lightmap_pars_fragment,
      THREE.ShaderChunk.envmap_pars_fragment,
      THREE.ShaderChunk.fog_pars_fragment,
      THREE.ShaderChunk.lights_phong_pars_fragment,
      THREE.ShaderChunk.shadowmap_pars_fragment,
      THREE.ShaderChunk.bumpmap_pars_fragment,
      THREE.ShaderChunk.normalmap_pars_fragment,
      THREE.ShaderChunk.specularmap_pars_fragment,
      "void main() {\ngl_FragColor = vec4( vec3 ( 1.0 ), opacity );",
      THREE.ShaderChunk.map_fragment,
      THREE.ShaderChunk.alphatest_fragment,
      THREE.ShaderChunk.specularmap_fragment,
      THREE.ShaderChunk.lights_phong_fragment,
      THREE.ShaderChunk.lightmap_fragment,
      THREE.ShaderChunk.color_fragment,
      THREE.ShaderChunk.envmap_fragment,
      THREE.ShaderChunk.shadowmap_fragment,
      THREE.ShaderChunk.linear_to_gamma_fragment,
      THREE.ShaderChunk.fog_fragment,
      "}",
    ].join("\n"),
  },
  particle_basic: {
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.particle,
      THREE.UniformsLib.shadowmap,
    ]),
    vertexShader: [
      "uniform float size;\nuniform float scale;",
      THREE.ShaderChunk.color_pars_vertex,
      THREE.ShaderChunk.shadowmap_pars_vertex,
      "void main() {",
      THREE.ShaderChunk.color_vertex,
      "vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );\n#ifdef USE_SIZEATTENUATION\ngl_PointSize = size * ( scale / length( mvPosition.xyz ) );\n#else\ngl_PointSize = size;\n#endif\ngl_Position = projectionMatrix * mvPosition;",
      THREE.ShaderChunk.worldpos_vertex,
      THREE.ShaderChunk.shadowmap_vertex,
      "}",
    ].join("\n"),
    fragmentShader: [
      "uniform vec3 psColor;\nuniform float opacity;",
      THREE.ShaderChunk.color_pars_fragment,
      THREE.ShaderChunk.map_particle_pars_fragment,
      THREE.ShaderChunk.fog_pars_fragment,
      THREE.ShaderChunk.shadowmap_pars_fragment,
      "void main() {\ngl_FragColor = vec4( psColor, opacity );",
      THREE.ShaderChunk.map_particle_fragment,
      THREE.ShaderChunk.alphatest_fragment,
      THREE.ShaderChunk.color_fragment,
      THREE.ShaderChunk.shadowmap_fragment,
      THREE.ShaderChunk.fog_fragment,
      "}",
    ].join("\n"),
  },
  dashed: {
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.common,
      THREE.UniformsLib.fog,
      {
        scale: { type: "f", value: 1 },
        dashSize: { type: "f", value: 1 },
        totalSize: { type: "f", value: 2 },
      },
    ]),
    vertexShader: [
      "uniform float scale;\nattribute float lineDistance;\nvarying float vLineDistance;",
      THREE.ShaderChunk.color_pars_vertex,
      "void main() {",
      THREE.ShaderChunk.color_vertex,
      "vLineDistance = scale * lineDistance;\nvec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );\ngl_Position = projectionMatrix * mvPosition;\n}",
    ].join("\n"),
    fragmentShader: [
      "uniform vec3 diffuse;\nuniform float opacity;\nuniform float dashSize;\nuniform float totalSize;\nvarying float vLineDistance;",
      THREE.ShaderChunk.color_pars_fragment,
      THREE.ShaderChunk.fog_pars_fragment,
      "void main() {\nif ( mod( vLineDistance, totalSize ) > dashSize ) {\ndiscard;\n}\ngl_FragColor = vec4( diffuse, opacity );",
      THREE.ShaderChunk.color_fragment,
      THREE.ShaderChunk.fog_fragment,
      "}",
    ].join("\n"),
  },
  depth: {
    uniforms: {
      mNear: { type: "f", value: 1 },
      mFar: { type: "f", value: 2e3 },
      opacity: { type: "f", value: 1 },
    },
    vertexShader:
      "void main() {\ngl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}",
    fragmentShader:
      "uniform float mNear;\nuniform float mFar;\nuniform float opacity;\nvoid main() {\nfloat depth = gl_FragCoord.z / gl_FragCoord.w;\nfloat color = 1.0 - smoothstep( mNear, mFar, depth );\ngl_FragColor = vec4( vec3( color ), opacity );\n}",
  },
  normal: {
    uniforms: { opacity: { type: "f", value: 1 } },
    vertexShader: [
      "varying vec3 vNormal;",
      THREE.ShaderChunk.morphtarget_pars_vertex,
      "void main() {\nvNormal = normalize( normalMatrix * normal );",
      THREE.ShaderChunk.morphtarget_vertex,
      THREE.ShaderChunk.default_vertex,
      "}",
    ].join("\n"),
    fragmentShader:
      "uniform float opacity;\nvarying vec3 vNormal;\nvoid main() {\ngl_FragColor = vec4( 0.5 * normalize( vNormal ) + 0.5, opacity );\n}",
  },
  normalmap: {
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      THREE.UniformsLib.lights,
      THREE.UniformsLib.shadowmap,
      {
        enableAO: { type: "i", value: 0 },
        enableDiffuse: { type: "i", value: 0 },
        enableSpecular: { type: "i", value: 0 },
        enableReflection: { type: "i", value: 0 },
        enableDisplacement: { type: "i", value: 0 },
        tDisplacement: { type: "t", value: null },
        tDiffuse: { type: "t", value: null },
        tCube: { type: "t", value: null },
        tNormal: { type: "t", value: null },
        tSpecular: { type: "t", value: null },
        tAO: { type: "t", value: null },
        uNormalScale: { type: "v2", value: new THREE.Vector2(1, 1) },
        uDisplacementBias: { type: "f", value: 0 },
        uDisplacementScale: { type: "f", value: 1 },
        uDiffuseColor: { type: "c", value: new THREE.Color(16777215) },
        uSpecularColor: { type: "c", value: new THREE.Color(1118481) },
        uAmbientColor: { type: "c", value: new THREE.Color(16777215) },
        uShininess: { type: "f", value: 30 },
        uOpacity: { type: "f", value: 1 },
        useRefract: { type: "i", value: 0 },
        uRefractionRatio: { type: "f", value: 0.98 },
        uReflectivity: { type: "f", value: 0.5 },
        uOffset: { type: "v2", value: new THREE.Vector2(0, 0) },
        uRepeat: { type: "v2", value: new THREE.Vector2(1, 1) },
        wrapRGB: { type: "v3", value: new THREE.Vector3(1, 1, 1) },
      },
    ]),
    fragmentShader: [
      "uniform vec3 uAmbientColor;\nuniform vec3 uDiffuseColor;\nuniform vec3 uSpecularColor;\nuniform float uShininess;\nuniform float uOpacity;\nuniform bool enableDiffuse;\nuniform bool enableSpecular;\nuniform bool enableAO;\nuniform bool enableReflection;\nuniform sampler2D tDiffuse;\nuniform sampler2D tNormal;\nuniform sampler2D tSpecular;\nuniform sampler2D tAO;\nuniform samplerCube tCube;\nuniform vec2 uNormalScale;\nuniform bool useRefract;\nuniform float uRefractionRatio;\nuniform float uReflectivity;\nvarying vec3 vTangent;\nvarying vec3 vBinormal;\nvarying vec3 vNormal;\nvarying vec2 vUv;\nuniform vec3 ambientLightColor;\n#if MAX_DIR_LIGHTS > 0\nuniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];\nuniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];\n#endif\n#if MAX_HEMI_LIGHTS > 0\nuniform vec3 hemisphereLightSkyColor[ MAX_HEMI_LIGHTS ];\nuniform vec3 hemisphereLightGroundColor[ MAX_HEMI_LIGHTS ];\nuniform vec3 hemisphereLightDirection[ MAX_HEMI_LIGHTS ];\n#endif\n#if MAX_POINT_LIGHTS > 0\nuniform vec3 pointLightColor[ MAX_POINT_LIGHTS ];\nuniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];\nuniform float pointLightDistance[ MAX_POINT_LIGHTS ];\n#endif\n#if MAX_SPOT_LIGHTS > 0\nuniform vec3 spotLightColor[ MAX_SPOT_LIGHTS ];\nuniform vec3 spotLightPosition[ MAX_SPOT_LIGHTS ];\nuniform vec3 spotLightDirection[ MAX_SPOT_LIGHTS ];\nuniform float spotLightAngleCos[ MAX_SPOT_LIGHTS ];\nuniform float spotLightExponent[ MAX_SPOT_LIGHTS ];\nuniform float spotLightDistance[ MAX_SPOT_LIGHTS ];\n#endif\n#ifdef WRAP_AROUND\nuniform vec3 wrapRGB;\n#endif\nvarying vec3 vWorldPosition;\nvarying vec3 vViewPosition;",
      THREE.ShaderChunk.shadowmap_pars_fragment,
      THREE.ShaderChunk.fog_pars_fragment,
      "void main() {\ngl_FragColor = vec4( vec3( 1.0 ), uOpacity );\nvec3 specularTex = vec3( 1.0 );\nvec3 normalTex = texture2D( tNormal, vUv ).xyz * 2.0 - 1.0;\nnormalTex.xy *= uNormalScale;\nnormalTex = normalize( normalTex );\nif( enableDiffuse ) {\n#ifdef GAMMA_INPUT\nvec4 texelColor = texture2D( tDiffuse, vUv );\ntexelColor.xyz *= texelColor.xyz;\ngl_FragColor = gl_FragColor * texelColor;\n#else\ngl_FragColor = gl_FragColor * texture2D( tDiffuse, vUv );\n#endif\n}\nif( enableAO ) {\n#ifdef GAMMA_INPUT\nvec4 aoColor = texture2D( tAO, vUv );\naoColor.xyz *= aoColor.xyz;\ngl_FragColor.xyz = gl_FragColor.xyz * aoColor.xyz;\n#else\ngl_FragColor.xyz = gl_FragColor.xyz * texture2D( tAO, vUv ).xyz;\n#endif\n}\nif( enableSpecular )\nspecularTex = texture2D( tSpecular, vUv ).xyz;\nmat3 tsb = mat3( normalize( vTangent ), normalize( vBinormal ), normalize( vNormal ) );\nvec3 finalNormal = tsb * normalTex;\n#ifdef FLIP_SIDED\nfinalNormal = -finalNormal;\n#endif\nvec3 normal = normalize( finalNormal );\nvec3 viewPosition = normalize( vViewPosition );\n#if MAX_POINT_LIGHTS > 0\nvec3 pointDiffuse = vec3( 0.0 );\nvec3 pointSpecular = vec3( 0.0 );\nfor ( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {\nvec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );\nvec3 pointVector = lPosition.xyz + vViewPosition.xyz;\nfloat pointDistance = 1.0;\nif ( pointLightDistance[ i ] > 0.0 )\npointDistance = 1.0 - min( ( length( pointVector ) / pointLightDistance[ i ] ), 1.0 );\npointVector = normalize( pointVector );\n#ifdef WRAP_AROUND\nfloat pointDiffuseWeightFull = max( dot( normal, pointVector ), 0.0 );\nfloat pointDiffuseWeightHalf = max( 0.5 * dot( normal, pointVector ) + 0.5, 0.0 );\nvec3 pointDiffuseWeight = mix( vec3 ( pointDiffuseWeightFull ), vec3( pointDiffuseWeightHalf ), wrapRGB );\n#else\nfloat pointDiffuseWeight = max( dot( normal, pointVector ), 0.0 );\n#endif\npointDiffuse += pointDistance * pointLightColor[ i ] * uDiffuseColor * pointDiffuseWeight;\nvec3 pointHalfVector = normalize( pointVector + viewPosition );\nfloat pointDotNormalHalf = max( dot( normal, pointHalfVector ), 0.0 );\nfloat pointSpecularWeight = specularTex.r * max( pow( pointDotNormalHalf, uShininess ), 0.0 );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat specularNormalization = ( uShininess + 2.0001 ) / 8.0;\nvec3 schlick = uSpecularColor + vec3( 1.0 - uSpecularColor ) * pow( 1.0 - dot( pointVector, pointHalfVector ), 5.0 );\npointSpecular += schlick * pointLightColor[ i ] * pointSpecularWeight * pointDiffuseWeight * pointDistance * specularNormalization;\n#else\npointSpecular += pointDistance * pointLightColor[ i ] * uSpecularColor * pointSpecularWeight * pointDiffuseWeight;\n#endif\n}\n#endif\n#if MAX_SPOT_LIGHTS > 0\nvec3 spotDiffuse = vec3( 0.0 );\nvec3 spotSpecular = vec3( 0.0 );\nfor ( int i = 0; i < MAX_SPOT_LIGHTS; i ++ ) {\nvec4 lPosition = viewMatrix * vec4( spotLightPosition[ i ], 1.0 );\nvec3 spotVector = lPosition.xyz + vViewPosition.xyz;\nfloat spotDistance = 1.0;\nif ( spotLightDistance[ i ] > 0.0 )\nspotDistance = 1.0 - min( ( length( spotVector ) / spotLightDistance[ i ] ), 1.0 );\nspotVector = normalize( spotVector );\nfloat spotEffect = dot( spotLightDirection[ i ], normalize( spotLightPosition[ i ] - vWorldPosition ) );\nif ( spotEffect > spotLightAngleCos[ i ] ) {\nspotEffect = max( pow( spotEffect, spotLightExponent[ i ] ), 0.0 );\n#ifdef WRAP_AROUND\nfloat spotDiffuseWeightFull = max( dot( normal, spotVector ), 0.0 );\nfloat spotDiffuseWeightHalf = max( 0.5 * dot( normal, spotVector ) + 0.5, 0.0 );\nvec3 spotDiffuseWeight = mix( vec3 ( spotDiffuseWeightFull ), vec3( spotDiffuseWeightHalf ), wrapRGB );\n#else\nfloat spotDiffuseWeight = max( dot( normal, spotVector ), 0.0 );\n#endif\nspotDiffuse += spotDistance * spotLightColor[ i ] * uDiffuseColor * spotDiffuseWeight * spotEffect;\nvec3 spotHalfVector = normalize( spotVector + viewPosition );\nfloat spotDotNormalHalf = max( dot( normal, spotHalfVector ), 0.0 );\nfloat spotSpecularWeight = specularTex.r * max( pow( spotDotNormalHalf, uShininess ), 0.0 );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat specularNormalization = ( uShininess + 2.0001 ) / 8.0;\nvec3 schlick = uSpecularColor + vec3( 1.0 - uSpecularColor ) * pow( 1.0 - dot( spotVector, spotHalfVector ), 5.0 );\nspotSpecular += schlick * spotLightColor[ i ] * spotSpecularWeight * spotDiffuseWeight * spotDistance * specularNormalization * spotEffect;\n#else\nspotSpecular += spotDistance * spotLightColor[ i ] * uSpecularColor * spotSpecularWeight * spotDiffuseWeight * spotEffect;\n#endif\n}\n}\n#endif\n#if MAX_DIR_LIGHTS > 0\nvec3 dirDiffuse = vec3( 0.0 );\nvec3 dirSpecular = vec3( 0.0 );\nfor( int i = 0; i < MAX_DIR_LIGHTS; i++ ) {\nvec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );\nvec3 dirVector = normalize( lDirection.xyz );\n#ifdef WRAP_AROUND\nfloat directionalLightWeightingFull = max( dot( normal, dirVector ), 0.0 );\nfloat directionalLightWeightingHalf = max( 0.5 * dot( normal, dirVector ) + 0.5, 0.0 );\nvec3 dirDiffuseWeight = mix( vec3( directionalLightWeightingFull ), vec3( directionalLightWeightingHalf ), wrapRGB );\n#else\nfloat dirDiffuseWeight = max( dot( normal, dirVector ), 0.0 );\n#endif\ndirDiffuse += directionalLightColor[ i ] * uDiffuseColor * dirDiffuseWeight;\nvec3 dirHalfVector = normalize( dirVector + viewPosition );\nfloat dirDotNormalHalf = max( dot( normal, dirHalfVector ), 0.0 );\nfloat dirSpecularWeight = specularTex.r * max( pow( dirDotNormalHalf, uShininess ), 0.0 );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat specularNormalization = ( uShininess + 2.0001 ) / 8.0;\nvec3 schlick = uSpecularColor + vec3( 1.0 - uSpecularColor ) * pow( 1.0 - dot( dirVector, dirHalfVector ), 5.0 );\ndirSpecular += schlick * directionalLightColor[ i ] * dirSpecularWeight * dirDiffuseWeight * specularNormalization;\n#else\ndirSpecular += directionalLightColor[ i ] * uSpecularColor * dirSpecularWeight * dirDiffuseWeight;\n#endif\n}\n#endif\n#if MAX_HEMI_LIGHTS > 0\nvec3 hemiDiffuse  = vec3( 0.0 );\nvec3 hemiSpecular = vec3( 0.0 );\nfor( int i = 0; i < MAX_HEMI_LIGHTS; i ++ ) {\nvec4 lDirection = viewMatrix * vec4( hemisphereLightDirection[ i ], 0.0 );\nvec3 lVector = normalize( lDirection.xyz );\nfloat dotProduct = dot( normal, lVector );\nfloat hemiDiffuseWeight = 0.5 * dotProduct + 0.5;\nvec3 hemiColor = mix( hemisphereLightGroundColor[ i ], hemisphereLightSkyColor[ i ], hemiDiffuseWeight );\nhemiDiffuse += uDiffuseColor * hemiColor;\nvec3 hemiHalfVectorSky = normalize( lVector + viewPosition );\nfloat hemiDotNormalHalfSky = 0.5 * dot( normal, hemiHalfVectorSky ) + 0.5;\nfloat hemiSpecularWeightSky = specularTex.r * max( pow( hemiDotNormalHalfSky, uShininess ), 0.0 );\nvec3 lVectorGround = -lVector;\nvec3 hemiHalfVectorGround = normalize( lVectorGround + viewPosition );\nfloat hemiDotNormalHalfGround = 0.5 * dot( normal, hemiHalfVectorGround ) + 0.5;\nfloat hemiSpecularWeightGround = specularTex.r * max( pow( hemiDotNormalHalfGround, uShininess ), 0.0 );\n#ifdef PHYSICALLY_BASED_SHADING\nfloat dotProductGround = dot( normal, lVectorGround );\nfloat specularNormalization = ( uShininess + 2.0001 ) / 8.0;\nvec3 schlickSky = uSpecularColor + vec3( 1.0 - uSpecularColor ) * pow( 1.0 - dot( lVector, hemiHalfVectorSky ), 5.0 );\nvec3 schlickGround = uSpecularColor + vec3( 1.0 - uSpecularColor ) * pow( 1.0 - dot( lVectorGround, hemiHalfVectorGround ), 5.0 );\nhemiSpecular += hemiColor * specularNormalization * ( schlickSky * hemiSpecularWeightSky * max( dotProduct, 0.0 ) + schlickGround * hemiSpecularWeightGround * max( dotProductGround, 0.0 ) );\n#else\nhemiSpecular += uSpecularColor * hemiColor * ( hemiSpecularWeightSky + hemiSpecularWeightGround ) * hemiDiffuseWeight;\n#endif\n}\n#endif\nvec3 totalDiffuse = vec3( 0.0 );\nvec3 totalSpecular = vec3( 0.0 );\n#if MAX_DIR_LIGHTS > 0\ntotalDiffuse += dirDiffuse;\ntotalSpecular += dirSpecular;\n#endif\n#if MAX_HEMI_LIGHTS > 0\ntotalDiffuse += hemiDiffuse;\ntotalSpecular += hemiSpecular;\n#endif\n#if MAX_POINT_LIGHTS > 0\ntotalDiffuse += pointDiffuse;\ntotalSpecular += pointSpecular;\n#endif\n#if MAX_SPOT_LIGHTS > 0\ntotalDiffuse += spotDiffuse;\ntotalSpecular += spotSpecular;\n#endif\n#ifdef METAL\ngl_FragColor.xyz = gl_FragColor.xyz * ( totalDiffuse + ambientLightColor * uAmbientColor + totalSpecular );\n#else\ngl_FragColor.xyz = gl_FragColor.xyz * ( totalDiffuse + ambientLightColor * uAmbientColor ) + totalSpecular;\n#endif\nif ( enableReflection ) {\nvec3 vReflect;\nvec3 cameraToVertex = normalize( vWorldPosition - cameraPosition );\nif ( useRefract ) {\nvReflect = refract( cameraToVertex, normal, uRefractionRatio );\n} else {\nvReflect = reflect( cameraToVertex, normal );\n}\nvec4 cubeColor = textureCube( tCube, vec3( -vReflect.x, vReflect.yz ) );\n#ifdef GAMMA_INPUT\ncubeColor.xyz *= cubeColor.xyz;\n#endif\ngl_FragColor.xyz = mix( gl_FragColor.xyz, cubeColor.xyz, specularTex.r * uReflectivity );\n}",
      THREE.ShaderChunk.shadowmap_fragment,
      THREE.ShaderChunk.linear_to_gamma_fragment,
      THREE.ShaderChunk.fog_fragment,
      "}",
    ].join("\n"),
    vertexShader: [
      "attribute vec4 tangent;\nuniform vec2 uOffset;\nuniform vec2 uRepeat;\nuniform bool enableDisplacement;\n#ifdef VERTEX_TEXTURES\nuniform sampler2D tDisplacement;\nuniform float uDisplacementScale;\nuniform float uDisplacementBias;\n#endif\nvarying vec3 vTangent;\nvarying vec3 vBinormal;\nvarying vec3 vNormal;\nvarying vec2 vUv;\nvarying vec3 vWorldPosition;\nvarying vec3 vViewPosition;",
      THREE.ShaderChunk.skinning_pars_vertex,
      THREE.ShaderChunk.shadowmap_pars_vertex,
      "void main() {",
      THREE.ShaderChunk.skinbase_vertex,
      THREE.ShaderChunk.skinnormal_vertex,
      "#ifdef USE_SKINNING\nvNormal = normalize( normalMatrix * skinnedNormal.xyz );\nvec4 skinnedTangent = skinMatrix * vec4( tangent.xyz, 0.0 );\nvTangent = normalize( normalMatrix * skinnedTangent.xyz );\n#else\nvNormal = normalize( normalMatrix * normal );\nvTangent = normalize( normalMatrix * tangent.xyz );\n#endif\nvBinormal = normalize( cross( vNormal, vTangent ) * tangent.w );\nvUv = uv * uRepeat + uOffset;\nvec3 displacedPosition;\n#ifdef VERTEX_TEXTURES\nif ( enableDisplacement ) {\nvec3 dv = texture2D( tDisplacement, uv ).xyz;\nfloat df = uDisplacementScale * dv.x + uDisplacementBias;\ndisplacedPosition = position + normalize( normal ) * df;\n} else {\n#ifdef USE_SKINNING\nvec4 skinVertex = vec4( position, 1.0 );\nvec4 skinned  = boneMatX * skinVertex * skinWeight.x;\nskinned \t  += boneMatY * skinVertex * skinWeight.y;\ndisplacedPosition  = skinned.xyz;\n#else\ndisplacedPosition = position;\n#endif\n}\n#else\n#ifdef USE_SKINNING\nvec4 skinVertex = vec4( position, 1.0 );\nvec4 skinned  = boneMatX * skinVertex * skinWeight.x;\nskinned \t  += boneMatY * skinVertex * skinWeight.y;\ndisplacedPosition  = skinned.xyz;\n#else\ndisplacedPosition = position;\n#endif\n#endif\nvec4 mvPosition = modelViewMatrix * vec4( displacedPosition, 1.0 );\nvec4 worldPosition = modelMatrix * vec4( displacedPosition, 1.0 );\ngl_Position = projectionMatrix * mvPosition;\nvWorldPosition = worldPosition.xyz;\nvViewPosition = -mvPosition.xyz;\n#ifdef USE_SHADOWMAP\nfor( int i = 0; i < MAX_SHADOWS; i ++ ) {\nvShadowCoord[ i ] = shadowMatrix[ i ] * worldPosition;\n}\n#endif\n}",
    ].join("\n"),
  },
  cube: {
    uniforms: {
      tCube: { type: "t", value: null },
      tFlip: { type: "f", value: -1 },
    },
    vertexShader:
      "varying vec3 vWorldPosition;\nvoid main() {\nvec4 worldPosition = modelMatrix * vec4( position, 1.0 );\nvWorldPosition = worldPosition.xyz;\ngl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}",
    fragmentShader:
      "uniform samplerCube tCube;\nuniform float tFlip;\nvarying vec3 vWorldPosition;\nvoid main() {\ngl_FragColor = textureCube( tCube, vec3( tFlip * vWorldPosition.x, vWorldPosition.yz ) );\n}",
  },
  depthRGBA: {
    uniforms: {},
    vertexShader: [
      THREE.ShaderChunk.morphtarget_pars_vertex,
      THREE.ShaderChunk.skinning_pars_vertex,
      "void main() {",
      THREE.ShaderChunk.skinbase_vertex,
      THREE.ShaderChunk.morphtarget_vertex,
      THREE.ShaderChunk.skinning_vertex,
      THREE.ShaderChunk.default_vertex,
      "}",
    ].join("\n"),
    fragmentShader:
      "vec4 pack_depth( const in float depth ) {\nconst vec4 bit_shift = vec4( 256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0 );\nconst vec4 bit_mask  = vec4( 0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0 );\nvec4 res = fract( depth * bit_shift );\nres -= res.xxyz * bit_mask;\nreturn res;\n}\nvoid main() {\ngl_FragData[ 0 ] = pack_depth( gl_FragCoord.z );\n}",
  },
};
THREE.WebGLRenderer = function (a) {
  function b(a) {
    if (a.__webglCustomAttributesList)
      for (var b in a.__webglCustomAttributesList)
        k.deleteBuffer(a.__webglCustomAttributesList[b].buffer);
  }
  function c(a, b) {
    var c = a.vertices.length,
      d = b.material;
    if (d.attributes) {
      void 0 === a.__webglCustomAttributesList &&
        (a.__webglCustomAttributesList = []);
      for (var e in d.attributes) {
        var f = d.attributes[e];
        if (!f.__webglInitialized || f.createUniqueBuffers) {
          f.__webglInitialized = !0;
          var g = 1;
          "v2" === f.type
            ? (g = 2)
            : "v3" === f.type
            ? (g = 3)
            : "v4" === f.type
            ? (g = 4)
            : "c" === f.type && (g = 3);
          f.size = g;
          f.array = new Float32Array(c * g);
          f.buffer = k.createBuffer();
          f.buffer.belongsToAttribute = e;
          f.needsUpdate = !0;
        }
        a.__webglCustomAttributesList.push(f);
      }
    }
  }
  function d(a, b) {
    var c = b.geometry,
      d = a.faces3,
      h = a.faces4,
      i = 3 * d.length + 4 * h.length,
      j = 1 * d.length + 2 * h.length,
      h = 3 * d.length + 4 * h.length,
      d = e(b, a),
      p = g(d),
      m = f(d),
      l = d.vertexColors ? d.vertexColors : !1;
    a.__vertexArray = new Float32Array(3 * i);
    m && (a.__normalArray = new Float32Array(3 * i));
    c.hasTangents && (a.__tangentArray = new Float32Array(4 * i));
    l && (a.__colorArray = new Float32Array(3 * i));
    if (p) {
      if (0 < c.faceUvs.length || 0 < c.faceVertexUvs.length)
        a.__uvArray = new Float32Array(2 * i);
      if (1 < c.faceUvs.length || 1 < c.faceVertexUvs.length)
        a.__uv2Array = new Float32Array(2 * i);
    }
    b.geometry.skinWeights.length &&
      b.geometry.skinIndices.length &&
      ((a.__skinIndexArray = new Float32Array(4 * i)),
      (a.__skinWeightArray = new Float32Array(4 * i)));
    a.__faceArray = new Uint16Array(3 * j);
    a.__lineArray = new Uint16Array(2 * h);
    if (a.numMorphTargets) {
      a.__morphTargetsArrays = [];
      c = 0;
      for (p = a.numMorphTargets; c < p; c++)
        a.__morphTargetsArrays.push(new Float32Array(3 * i));
    }
    if (a.numMorphNormals) {
      a.__morphNormalsArrays = [];
      c = 0;
      for (p = a.numMorphNormals; c < p; c++)
        a.__morphNormalsArrays.push(new Float32Array(3 * i));
    }
    a.__webglFaceCount = 3 * j;
    a.__webglLineCount = 2 * h;
    if (d.attributes) {
      void 0 === a.__webglCustomAttributesList &&
        (a.__webglCustomAttributesList = []);
      for (var n in d.attributes) {
        var j = d.attributes[n],
          c = {},
          q;
        for (q in j) c[q] = j[q];
        if (!c.__webglInitialized || c.createUniqueBuffers)
          (c.__webglInitialized = !0),
            (h = 1),
            "v2" === c.type
              ? (h = 2)
              : "v3" === c.type
              ? (h = 3)
              : "v4" === c.type
              ? (h = 4)
              : "c" === c.type && (h = 3),
            (c.size = h),
            (c.array = new Float32Array(i * h)),
            (c.buffer = k.createBuffer()),
            (c.buffer.belongsToAttribute = n),
            (j.needsUpdate = !0),
            (c.__original = j);
        a.__webglCustomAttributesList.push(c);
      }
    }
    a.__inittedArrays = !0;
  }
  function e(a, b) {
    return a.material instanceof THREE.MeshFaceMaterial
      ? a.material.materials[b.materialIndex]
      : a.material;
  }
  function f(a) {
    return (a instanceof THREE.MeshBasicMaterial && !a.envMap) ||
      a instanceof THREE.MeshDepthMaterial
      ? !1
      : a && void 0 !== a.shading && a.shading === THREE.SmoothShading
      ? THREE.SmoothShading
      : THREE.FlatShading;
  }
  function g(a) {
    return a.map ||
      a.lightMap ||
      a.bumpMap ||
      a.normalMap ||
      a.specularMap ||
      a instanceof THREE.ShaderMaterial
      ? !0
      : !1;
  }
  function h(a) {
    Ta[a] || (k.enableVertexAttribArray(a), (Ta[a] = !0));
  }
  function i() {
    for (var a in Ta) Ta[a] && (k.disableVertexAttribArray(a), (Ta[a] = !1));
  }
  function j(a, b) {
    return a.z !== b.z ? b.z - a.z : a.id - b.id;
  }
  function m(a, b) {
    return b[0] - a[0];
  }
  function p(a, b, c) {
    if (a.length)
      for (var d = 0, e = a.length; d < e; d++)
        (pa = ab = null),
          (Ka = qa = da = W = oa = kb = la = -1),
          (bb = !0),
          a[d].render(b, c, Tb, Ub),
          (pa = ab = null),
          (Ka = qa = da = W = oa = kb = la = -1),
          (bb = !0);
  }
  function l(a, b, c, d, e, f, g, h) {
    var i, k, j, p;
    b ? ((k = a.length - 1), (p = b = -1)) : ((k = 0), (b = a.length), (p = 1));
    for (var m = k; m !== b; m += p)
      if (((i = a[m]), i.render)) {
        k = i.object;
        j = i.buffer;
        if (h) i = h;
        else {
          i = i[c];
          if (!i) continue;
          g &&
            N.setBlending(i.blending, i.blendEquation, i.blendSrc, i.blendDst);
          N.setDepthTest(i.depthTest);
          N.setDepthWrite(i.depthWrite);
          K(i.polygonOffset, i.polygonOffsetFactor, i.polygonOffsetUnits);
        }
        N.setMaterialFaces(i);
        j instanceof THREE.BufferGeometry
          ? N.renderBufferDirect(d, e, f, i, j, k)
          : N.renderBuffer(d, e, f, i, j, k);
      }
  }
  function r(a, b, c, d, e, f, g) {
    for (var h, i, k = 0, j = a.length; k < j; k++)
      if (((h = a[k]), (i = h.object), i.visible)) {
        if (g) h = g;
        else {
          h = h[b];
          if (!h) continue;
          f &&
            N.setBlending(h.blending, h.blendEquation, h.blendSrc, h.blendDst);
          N.setDepthTest(h.depthTest);
          N.setDepthWrite(h.depthWrite);
          K(h.polygonOffset, h.polygonOffsetFactor, h.polygonOffsetUnits);
        }
        N.renderImmediateObject(c, d, e, h, i);
      }
  }
  function s(a, b) {
    var e, f, g, h;
    if (
      void 0 === a.__webglInit &&
      ((a.__webglInit = !0),
      (a._modelViewMatrix = new THREE.Matrix4()),
      (a._normalMatrix = new THREE.Matrix3()),
      void 0 !== a.geometry &&
        void 0 === a.geometry.__webglInit &&
        ((a.geometry.__webglInit = !0),
        a.geometry.addEventListener("dispose", gc)),
      (f = a.geometry),
      void 0 !== f)
    )
      if (f instanceof THREE.BufferGeometry) {
        var i, j;
        for (i in f.attributes)
          (j = "index" === i ? k.ELEMENT_ARRAY_BUFFER : k.ARRAY_BUFFER),
            (h = f.attributes[i]),
            (h.buffer = k.createBuffer()),
            k.bindBuffer(j, h.buffer),
            k.bufferData(j, h.array, k.STATIC_DRAW);
      } else if (a instanceof THREE.Mesh) {
        g = a.material;
        if (void 0 === f.geometryGroups) {
          i = f;
          var p, m, l, q, r;
          j = {};
          var s = i.morphTargets.length,
            t = i.morphNormals.length,
            u = g instanceof THREE.MeshFaceMaterial;
          i.geometryGroups = {};
          g = 0;
          for (p = i.faces.length; g < p; g++)
            (m = i.faces[g]),
              (l = u ? m.materialIndex : 0),
              void 0 === j[l] && (j[l] = { hash: l, counter: 0 }),
              (r = j[l].hash + "_" + j[l].counter),
              void 0 === i.geometryGroups[r] &&
                (i.geometryGroups[r] = {
                  faces3: [],
                  faces4: [],
                  materialIndex: l,
                  vertices: 0,
                  numMorphTargets: s,
                  numMorphNormals: t,
                }),
              (q = m instanceof THREE.Face3 ? 3 : 4),
              65535 < i.geometryGroups[r].vertices + q &&
                ((j[l].counter += 1),
                (r = j[l].hash + "_" + j[l].counter),
                void 0 === i.geometryGroups[r] &&
                  (i.geometryGroups[r] = {
                    faces3: [],
                    faces4: [],
                    materialIndex: l,
                    vertices: 0,
                    numMorphTargets: s,
                    numMorphNormals: t,
                  })),
              m instanceof THREE.Face3
                ? i.geometryGroups[r].faces3.push(g)
                : i.geometryGroups[r].faces4.push(g),
              (i.geometryGroups[r].vertices += q);
          i.geometryGroupsList = [];
          for (h in i.geometryGroups)
            (i.geometryGroups[h].id = Z++),
              i.geometryGroupsList.push(i.geometryGroups[h]);
        }
        for (e in f.geometryGroups)
          if (((h = f.geometryGroups[e]), !h.__webglVertexBuffer)) {
            i = h;
            i.__webglVertexBuffer = k.createBuffer();
            i.__webglNormalBuffer = k.createBuffer();
            i.__webglTangentBuffer = k.createBuffer();
            i.__webglColorBuffer = k.createBuffer();
            i.__webglUVBuffer = k.createBuffer();
            i.__webglUV2Buffer = k.createBuffer();
            i.__webglSkinIndicesBuffer = k.createBuffer();
            i.__webglSkinWeightsBuffer = k.createBuffer();
            i.__webglFaceBuffer = k.createBuffer();
            i.__webglLineBuffer = k.createBuffer();
            s = j = void 0;
            if (i.numMorphTargets) {
              i.__webglMorphTargetsBuffers = [];
              j = 0;
              for (s = i.numMorphTargets; j < s; j++)
                i.__webglMorphTargetsBuffers.push(k.createBuffer());
            }
            if (i.numMorphNormals) {
              i.__webglMorphNormalsBuffers = [];
              j = 0;
              for (s = i.numMorphNormals; j < s; j++)
                i.__webglMorphNormalsBuffers.push(k.createBuffer());
            }
            N.info.memory.geometries++;
            d(h, a);
            f.verticesNeedUpdate = !0;
            f.morphTargetsNeedUpdate = !0;
            f.elementsNeedUpdate = !0;
            f.uvsNeedUpdate = !0;
            f.normalsNeedUpdate = !0;
            f.tangentsNeedUpdate = !0;
            f.colorsNeedUpdate = !0;
          }
      } else
        a instanceof THREE.Ribbon
          ? f.__webglVertexBuffer ||
            ((h = f),
            (h.__webglVertexBuffer = k.createBuffer()),
            (h.__webglColorBuffer = k.createBuffer()),
            (h.__webglNormalBuffer = k.createBuffer()),
            N.info.memory.geometries++,
            (h = f),
            (i = h.vertices.length),
            (h.__vertexArray = new Float32Array(3 * i)),
            (h.__colorArray = new Float32Array(3 * i)),
            (h.__normalArray = new Float32Array(3 * i)),
            (h.__webglVertexCount = i),
            c(h, a),
            (f.verticesNeedUpdate = !0),
            (f.colorsNeedUpdate = !0),
            (f.normalsNeedUpdate = !0))
          : a instanceof THREE.Line
          ? f.__webglVertexBuffer ||
            ((h = f),
            (h.__webglVertexBuffer = k.createBuffer()),
            (h.__webglColorBuffer = k.createBuffer()),
            (h.__webglLineDistanceBuffer = k.createBuffer()),
            N.info.memory.geometries++,
            (h = f),
            (i = h.vertices.length),
            (h.__vertexArray = new Float32Array(3 * i)),
            (h.__colorArray = new Float32Array(3 * i)),
            (h.__lineDistanceArray = new Float32Array(1 * i)),
            (h.__webglLineCount = i),
            c(h, a),
            (f.verticesNeedUpdate = !0),
            (f.colorsNeedUpdate = !0),
            (f.lineDistancesNeedUpdate = !0))
          : a instanceof THREE.ParticleSystem &&
            !f.__webglVertexBuffer &&
            ((h = f),
            (h.__webglVertexBuffer = k.createBuffer()),
            (h.__webglColorBuffer = k.createBuffer()),
            N.info.memory.geometries++,
            (h = f),
            (i = h.vertices.length),
            (h.__vertexArray = new Float32Array(3 * i)),
            (h.__colorArray = new Float32Array(3 * i)),
            (h.__sortArray = []),
            (h.__webglParticleCount = i),
            c(h, a),
            (f.verticesNeedUpdate = !0),
            (f.colorsNeedUpdate = !0));
    if (void 0 === a.__webglActive) {
      if (a instanceof THREE.Mesh)
        if (((f = a.geometry), f instanceof THREE.BufferGeometry))
          n(b.__webglObjects, f, a);
        else {
          if (f instanceof THREE.Geometry)
            for (e in f.geometryGroups)
              (h = f.geometryGroups[e]), n(b.__webglObjects, h, a);
        }
      else
        a instanceof THREE.Ribbon ||
        a instanceof THREE.Line ||
        a instanceof THREE.ParticleSystem
          ? ((f = a.geometry), n(b.__webglObjects, f, a))
          : a instanceof THREE.ImmediateRenderObject ||
            a.immediateRenderCallback
          ? b.__webglObjectsImmediate.push({
              object: a,
              opaque: null,
              transparent: null,
            })
          : a instanceof THREE.Sprite
          ? b.__webglSprites.push(a)
          : a instanceof THREE.LensFlare && b.__webglFlares.push(a);
      a.__webglActive = !0;
    }
  }
  function n(a, b, c) {
    a.push({ buffer: b, object: c, opaque: null, transparent: null });
  }
  function q(a) {
    for (var b in a.attributes) if (a.attributes[b].needsUpdate) return !0;
    return !1;
  }
  function y(a) {
    for (var b in a.attributes) a.attributes[b].needsUpdate = !1;
  }
  function u(a, b) {
    a instanceof THREE.Mesh ||
    a instanceof THREE.ParticleSystem ||
    a instanceof THREE.Ribbon ||
    a instanceof THREE.Line
      ? x(b.__webglObjects, a)
      : a instanceof THREE.Sprite
      ? t(b.__webglSprites, a)
      : a instanceof THREE.LensFlare
      ? t(b.__webglFlares, a)
      : (a instanceof THREE.ImmediateRenderObject ||
          a.immediateRenderCallback) &&
        x(b.__webglObjectsImmediate, a);
    delete a.__webglActive;
  }
  function x(a, b) {
    for (var c = a.length - 1; 0 <= c; c--) a[c].object === b && a.splice(c, 1);
  }
  function t(a, b) {
    for (var c = a.length - 1; 0 <= c; c--) a[c] === b && a.splice(c, 1);
  }
  function E(a, b, c, d, e) {
    ga = 0;
    d.needsUpdate &&
      (d.program && pc(d), N.initMaterial(d, b, c, e), (d.needsUpdate = !1));
    d.morphTargets &&
      !e.__webglMorphTargetInfluences &&
      (e.__webglMorphTargetInfluences = new Float32Array(N.maxMorphTargets));
    var f = !1,
      g = d.program,
      h = g.uniforms,
      i = d.uniforms;
    g !== ab && (k.useProgram(g), (ab = g), (f = !0));
    d.id !== Ka && ((Ka = d.id), (f = !0));
    if (f || a !== pa)
      k.uniformMatrix4fv(h.projectionMatrix, !1, a.projectionMatrix.elements),
        a !== pa && (pa = a);
    if (d.skinning)
      if (Vb && e.useVertexTexture) {
        if (null !== h.boneTexture) {
          var j = J();
          k.uniform1i(h.boneTexture, j);
          N.setTexture(e.boneTexture, j);
        }
      } else
        null !== h.boneGlobalMatrices &&
          k.uniformMatrix4fv(h.boneGlobalMatrices, !1, e.boneMatrices);
    if (f) {
      c &&
        d.fog &&
        ((i.fogColor.value = c.color),
        c instanceof THREE.Fog
          ? ((i.fogNear.value = c.near), (i.fogFar.value = c.far))
          : c instanceof THREE.FogExp2 && (i.fogDensity.value = c.density));
      if (
        d instanceof THREE.MeshPhongMaterial ||
        d instanceof THREE.MeshLambertMaterial ||
        d.lights
      ) {
        if (bb) {
          for (
            var p,
              l = (j = 0),
              m = 0,
              n,
              q,
              r,
              s = Ab,
              t = s.directional.colors,
              u = s.directional.positions,
              x = s.point.colors,
              y = s.point.positions,
              E = s.point.distances,
              C = s.spot.colors,
              G = s.spot.positions,
              H = s.spot.distances,
              D = s.spot.directions,
              L = s.spot.anglesCos,
              K = s.spot.exponents,
              O = s.hemi.skyColors,
              A = s.hemi.groundColors,
              U = s.hemi.positions,
              R = 0,
              V = 0,
              fa = 0,
              W = 0,
              Z = 0,
              S = 0,
              T = 0,
              Q = 0,
              aa = (p = 0),
              c = (r = aa = 0),
              f = b.length;
            c < f;
            c++
          )
            (p = b[c]),
              p.onlyShadow ||
                ((n = p.color),
                (q = p.intensity),
                (r = p.distance),
                p instanceof THREE.AmbientLight
                  ? p.visible &&
                    (N.gammaInput
                      ? ((j += n.r * n.r), (l += n.g * n.g), (m += n.b * n.b))
                      : ((j += n.r), (l += n.g), (m += n.b)))
                  : p instanceof THREE.DirectionalLight
                  ? ((Z += 1),
                    p.visible &&
                      (ra.getPositionFromMatrix(p.matrixWorld),
                      Na.getPositionFromMatrix(p.target.matrixWorld),
                      ra.sub(Na),
                      ra.normalize(),
                      (0 === ra.x && 0 === ra.y && 0 === ra.z) ||
                        ((p = 3 * R),
                        (u[p] = ra.x),
                        (u[p + 1] = ra.y),
                        (u[p + 2] = ra.z),
                        N.gammaInput ? F(t, p, n, q * q) : z(t, p, n, q),
                        (R += 1))))
                  : p instanceof THREE.PointLight
                  ? ((S += 1),
                    p.visible &&
                      ((aa = 3 * V),
                      N.gammaInput ? F(x, aa, n, q * q) : z(x, aa, n, q),
                      Na.getPositionFromMatrix(p.matrixWorld),
                      (y[aa] = Na.x),
                      (y[aa + 1] = Na.y),
                      (y[aa + 2] = Na.z),
                      (E[V] = r),
                      (V += 1)))
                  : p instanceof THREE.SpotLight
                  ? ((T += 1),
                    p.visible &&
                      ((aa = 3 * fa),
                      N.gammaInput ? F(C, aa, n, q * q) : z(C, aa, n, q),
                      Na.getPositionFromMatrix(p.matrixWorld),
                      (G[aa] = Na.x),
                      (G[aa + 1] = Na.y),
                      (G[aa + 2] = Na.z),
                      (H[fa] = r),
                      ra.copy(Na),
                      Na.getPositionFromMatrix(p.target.matrixWorld),
                      ra.sub(Na),
                      ra.normalize(),
                      (D[aa] = ra.x),
                      (D[aa + 1] = ra.y),
                      (D[aa + 2] = ra.z),
                      (L[fa] = Math.cos(p.angle)),
                      (K[fa] = p.exponent),
                      (fa += 1)))
                  : p instanceof THREE.HemisphereLight &&
                    ((Q += 1),
                    p.visible &&
                      (ra.getPositionFromMatrix(p.matrixWorld),
                      ra.normalize(),
                      (0 === ra.x && 0 === ra.y && 0 === ra.z) ||
                        ((r = 3 * W),
                        (U[r] = ra.x),
                        (U[r + 1] = ra.y),
                        (U[r + 2] = ra.z),
                        (n = p.color),
                        (p = p.groundColor),
                        N.gammaInput
                          ? ((q *= q), F(O, r, n, q), F(A, r, p, q))
                          : (z(O, r, n, q), z(A, r, p, q)),
                        (W += 1)))));
          c = 3 * R;
          for (f = Math.max(t.length, 3 * Z); c < f; c++) t[c] = 0;
          c = 3 * V;
          for (f = Math.max(x.length, 3 * S); c < f; c++) x[c] = 0;
          c = 3 * fa;
          for (f = Math.max(C.length, 3 * T); c < f; c++) C[c] = 0;
          c = 3 * W;
          for (f = Math.max(O.length, 3 * Q); c < f; c++) O[c] = 0;
          c = 3 * W;
          for (f = Math.max(A.length, 3 * Q); c < f; c++) A[c] = 0;
          s.directional.length = R;
          s.point.length = V;
          s.spot.length = fa;
          s.hemi.length = W;
          s.ambient[0] = j;
          s.ambient[1] = l;
          s.ambient[2] = m;
          bb = !1;
        }
        c = Ab;
        i.ambientLightColor.value = c.ambient;
        i.directionalLightColor.value = c.directional.colors;
        i.directionalLightDirection.value = c.directional.positions;
        i.pointLightColor.value = c.point.colors;
        i.pointLightPosition.value = c.point.positions;
        i.pointLightDistance.value = c.point.distances;
        i.spotLightColor.value = c.spot.colors;
        i.spotLightPosition.value = c.spot.positions;
        i.spotLightDistance.value = c.spot.distances;
        i.spotLightDirection.value = c.spot.directions;
        i.spotLightAngleCos.value = c.spot.anglesCos;
        i.spotLightExponent.value = c.spot.exponents;
        i.hemisphereLightSkyColor.value = c.hemi.skyColors;
        i.hemisphereLightGroundColor.value = c.hemi.groundColors;
        i.hemisphereLightDirection.value = c.hemi.positions;
      }
      if (
        d instanceof THREE.MeshBasicMaterial ||
        d instanceof THREE.MeshLambertMaterial ||
        d instanceof THREE.MeshPhongMaterial
      ) {
        i.opacity.value = d.opacity;
        N.gammaInput
          ? i.diffuse.value.copyGammaToLinear(d.color)
          : (i.diffuse.value = d.color);
        i.map.value = d.map;
        i.lightMap.value = d.lightMap;
        i.specularMap.value = d.specularMap;
        d.bumpMap &&
          ((i.bumpMap.value = d.bumpMap), (i.bumpScale.value = d.bumpScale));
        d.normalMap &&
          ((i.normalMap.value = d.normalMap),
          i.normalScale.value.copy(d.normalScale));
        var P;
        d.map
          ? (P = d.map)
          : d.specularMap
          ? (P = d.specularMap)
          : d.normalMap
          ? (P = d.normalMap)
          : d.bumpMap && (P = d.bumpMap);
        void 0 !== P &&
          ((c = P.offset),
          (P = P.repeat),
          i.offsetRepeat.value.set(c.x, c.y, P.x, P.y));
        i.envMap.value = d.envMap;
        i.flipEnvMap.value =
          d.envMap instanceof THREE.WebGLRenderTargetCube ? 1 : -1;
        i.reflectivity.value = d.reflectivity;
        i.refractionRatio.value = d.refractionRatio;
        i.combine.value = d.combine;
        i.useRefract.value =
          d.envMap && d.envMap.mapping instanceof THREE.CubeRefractionMapping;
      }
      d instanceof THREE.LineBasicMaterial
        ? ((i.diffuse.value = d.color), (i.opacity.value = d.opacity))
        : d instanceof THREE.LineDashedMaterial
        ? ((i.diffuse.value = d.color),
          (i.opacity.value = d.opacity),
          (i.dashSize.value = d.dashSize),
          (i.totalSize.value = d.dashSize + d.gapSize),
          (i.scale.value = d.scale))
        : d instanceof THREE.ParticleBasicMaterial
        ? ((i.psColor.value = d.color),
          (i.opacity.value = d.opacity),
          (i.size.value = d.size),
          (i.scale.value = M.height / 2),
          (i.map.value = d.map))
        : d instanceof THREE.MeshPhongMaterial
        ? ((i.shininess.value = d.shininess),
          N.gammaInput
            ? (i.ambient.value.copyGammaToLinear(d.ambient),
              i.emissive.value.copyGammaToLinear(d.emissive),
              i.specular.value.copyGammaToLinear(d.specular))
            : ((i.ambient.value = d.ambient),
              (i.emissive.value = d.emissive),
              (i.specular.value = d.specular)),
          d.wrapAround && i.wrapRGB.value.copy(d.wrapRGB))
        : d instanceof THREE.MeshLambertMaterial
        ? (N.gammaInput
            ? (i.ambient.value.copyGammaToLinear(d.ambient),
              i.emissive.value.copyGammaToLinear(d.emissive))
            : ((i.ambient.value = d.ambient), (i.emissive.value = d.emissive)),
          d.wrapAround && i.wrapRGB.value.copy(d.wrapRGB))
        : d instanceof THREE.MeshDepthMaterial
        ? ((i.mNear.value = a.near),
          (i.mFar.value = a.far),
          (i.opacity.value = d.opacity))
        : d instanceof THREE.MeshNormalMaterial &&
          (i.opacity.value = d.opacity);
      if (e.receiveShadow && !d._shadowPass && i.shadowMatrix) {
        c = P = 0;
        for (f = b.length; c < f; c++)
          if (
            ((j = b[c]),
            j.castShadow &&
              (j instanceof THREE.SpotLight ||
                (j instanceof THREE.DirectionalLight && !j.shadowCascade)))
          )
            (i.shadowMap.value[P] = j.shadowMap),
              (i.shadowMapSize.value[P] = j.shadowMapSize),
              (i.shadowMatrix.value[P] = j.shadowMatrix),
              (i.shadowDarkness.value[P] = j.shadowDarkness),
              (i.shadowBias.value[P] = j.shadowBias),
              P++;
      }
      b = d.uniformsList;
      i = 0;
      for (P = b.length; i < P; i++)
        if ((f = g.uniforms[b[i][1]]))
          if (((c = b[i][0]), (l = c.type), (j = c.value), "i" === l))
            k.uniform1i(f, j);
          else if ("f" === l) k.uniform1f(f, j);
          else if ("v2" === l) k.uniform2f(f, j.x, j.y);
          else if ("v3" === l) k.uniform3f(f, j.x, j.y, j.z);
          else if ("v4" === l) k.uniform4f(f, j.x, j.y, j.z, j.w);
          else if ("c" === l) k.uniform3f(f, j.r, j.g, j.b);
          else if ("iv1" === l) k.uniform1iv(f, j);
          else if ("iv" === l) k.uniform3iv(f, j);
          else if ("fv1" === l) k.uniform1fv(f, j);
          else if ("fv" === l) k.uniform3fv(f, j);
          else if ("v2v" === l) {
            void 0 === c._array && (c._array = new Float32Array(2 * j.length));
            l = 0;
            for (m = j.length; l < m; l++)
              (s = 2 * l), (c._array[s] = j[l].x), (c._array[s + 1] = j[l].y);
            k.uniform2fv(f, c._array);
          } else if ("v3v" === l) {
            void 0 === c._array && (c._array = new Float32Array(3 * j.length));
            l = 0;
            for (m = j.length; l < m; l++)
              (s = 3 * l),
                (c._array[s] = j[l].x),
                (c._array[s + 1] = j[l].y),
                (c._array[s + 2] = j[l].z);
            k.uniform3fv(f, c._array);
          } else if ("v4v" === l) {
            void 0 === c._array && (c._array = new Float32Array(4 * j.length));
            l = 0;
            for (m = j.length; l < m; l++)
              (s = 4 * l),
                (c._array[s] = j[l].x),
                (c._array[s + 1] = j[l].y),
                (c._array[s + 2] = j[l].z),
                (c._array[s + 3] = j[l].w);
            k.uniform4fv(f, c._array);
          } else if ("m4" === l)
            void 0 === c._array && (c._array = new Float32Array(16)),
              j.flattenToArray(c._array),
              k.uniformMatrix4fv(f, !1, c._array);
          else if ("m4v" === l) {
            void 0 === c._array && (c._array = new Float32Array(16 * j.length));
            l = 0;
            for (m = j.length; l < m; l++)
              j[l].flattenToArrayOffset(c._array, 16 * l);
            k.uniformMatrix4fv(f, !1, c._array);
          } else if ("t" === l) {
            if (((s = j), (j = J()), k.uniform1i(f, j), s))
              if (s.image instanceof Array && 6 === s.image.length) {
                if (((c = s), (f = j), 6 === c.image.length))
                  if (c.needsUpdate) {
                    c.image.__webglTextureCube ||
                      ((c.image.__webglTextureCube = k.createTexture()),
                      N.info.memory.textures++);
                    k.activeTexture(k.TEXTURE0 + f);
                    k.bindTexture(
                      k.TEXTURE_CUBE_MAP,
                      c.image.__webglTextureCube
                    );
                    k.pixelStorei(k.UNPACK_FLIP_Y_WEBGL, c.flipY);
                    f = c instanceof THREE.CompressedTexture;
                    j = [];
                    for (l = 0; 6 > l; l++)
                      N.autoScaleCubemaps && !f
                        ? ((m = j),
                          (s = l),
                          (t = c.image[l]),
                          (x = Ic),
                          (t.width <= x && t.height <= x) ||
                            ((y = Math.max(t.width, t.height)),
                            (u = Math.floor((t.width * x) / y)),
                            (x = Math.floor((t.height * x) / y)),
                            (y = document.createElement("canvas")),
                            (y.width = u),
                            (y.height = x),
                            y
                              .getContext("2d")
                              .drawImage(
                                t,
                                0,
                                0,
                                t.width,
                                t.height,
                                0,
                                0,
                                u,
                                x
                              ),
                            (t = y)),
                          (m[s] = t))
                        : (j[l] = c.image[l]);
                    l = j[0];
                    m =
                      0 === (l.width & (l.width - 1)) &&
                      0 === (l.height & (l.height - 1));
                    s = I(c.format);
                    t = I(c.type);
                    B(k.TEXTURE_CUBE_MAP, c, m);
                    for (l = 0; 6 > l; l++)
                      if (f) {
                        x = j[l].mipmaps;
                        y = 0;
                        for (E = x.length; y < E; y++)
                          (u = x[y]),
                            k.compressedTexImage2D(
                              k.TEXTURE_CUBE_MAP_POSITIVE_X + l,
                              y,
                              s,
                              u.width,
                              u.height,
                              0,
                              u.data
                            );
                      } else
                        k.texImage2D(
                          k.TEXTURE_CUBE_MAP_POSITIVE_X + l,
                          0,
                          s,
                          s,
                          t,
                          j[l]
                        );
                    c.generateMipmaps &&
                      m &&
                      k.generateMipmap(k.TEXTURE_CUBE_MAP);
                    c.needsUpdate = !1;
                    if (c.onUpdate) c.onUpdate();
                  } else
                    k.activeTexture(k.TEXTURE0 + f),
                      k.bindTexture(
                        k.TEXTURE_CUBE_MAP,
                        c.image.__webglTextureCube
                      );
              } else
                s instanceof THREE.WebGLRenderTargetCube
                  ? ((c = s),
                    k.activeTexture(k.TEXTURE0 + j),
                    k.bindTexture(k.TEXTURE_CUBE_MAP, c.__webglTexture))
                  : N.setTexture(s, j);
          } else if ("tv" === l) {
            void 0 === c._array && (c._array = []);
            l = 0;
            for (m = c.value.length; l < m; l++) c._array[l] = J();
            k.uniform1iv(f, c._array);
            l = 0;
            for (m = c.value.length; l < m; l++)
              (s = c.value[l]), (j = c._array[l]), s && N.setTexture(s, j);
          }
      if (
        (d instanceof THREE.ShaderMaterial ||
          d instanceof THREE.MeshPhongMaterial ||
          d.envMap) &&
        null !== h.cameraPosition
      )
        Na.getPositionFromMatrix(a.matrixWorld),
          k.uniform3f(h.cameraPosition, Na.x, Na.y, Na.z);
      (d instanceof THREE.MeshPhongMaterial ||
        d instanceof THREE.MeshLambertMaterial ||
        d instanceof THREE.ShaderMaterial ||
        d.skinning) &&
        null !== h.viewMatrix &&
        k.uniformMatrix4fv(h.viewMatrix, !1, a.matrixWorldInverse.elements);
    }
    k.uniformMatrix4fv(h.modelViewMatrix, !1, e._modelViewMatrix.elements);
    h.normalMatrix &&
      k.uniformMatrix3fv(h.normalMatrix, !1, e._normalMatrix.elements);
    null !== h.modelMatrix &&
      k.uniformMatrix4fv(h.modelMatrix, !1, e.matrixWorld.elements);
    return g;
  }
  function J() {
    var a = ga;
    a >= cc &&
      console.warn(
        "WebGLRenderer: trying to use " +
          a +
          " texture units while this GPU supports only " +
          cc
      );
    ga += 1;
    return a;
  }
  function F(a, b, c, d) {
    a[b] = c.r * c.r * d;
    a[b + 1] = c.g * c.g * d;
    a[b + 2] = c.b * c.b * d;
  }
  function z(a, b, c, d) {
    a[b] = c.r * d;
    a[b + 1] = c.g * d;
    a[b + 2] = c.b * d;
  }
  function H(a) {
    a !== Sa && (k.lineWidth(a), (Sa = a));
  }
  function K(a, b, c) {
    Xa !== a &&
      (a ? k.enable(k.POLYGON_OFFSET_FILL) : k.disable(k.POLYGON_OFFSET_FILL),
      (Xa = a));
    if (a && (Ra !== b || Aa !== c)) k.polygonOffset(b, c), (Ra = b), (Aa = c);
  }
  function G(a) {
    for (var a = a.split("\n"), b = 0, c = a.length; b < c; b++)
      a[b] = b + 1 + ": " + a[b];
    return a.join("\n");
  }
  function L(a, b) {
    var c;
    "fragment" === a
      ? (c = k.createShader(k.FRAGMENT_SHADER))
      : "vertex" === a && (c = k.createShader(k.VERTEX_SHADER));
    k.shaderSource(c, b);
    k.compileShader(c);
    return !k.getShaderParameter(c, k.COMPILE_STATUS)
      ? (console.error(k.getShaderInfoLog(c)), console.error(G(b)), null)
      : c;
  }
  function B(a, b, c) {
    c
      ? (k.texParameteri(a, k.TEXTURE_WRAP_S, I(b.wrapS)),
        k.texParameteri(a, k.TEXTURE_WRAP_T, I(b.wrapT)),
        k.texParameteri(a, k.TEXTURE_MAG_FILTER, I(b.magFilter)),
        k.texParameteri(a, k.TEXTURE_MIN_FILTER, I(b.minFilter)))
      : (k.texParameteri(a, k.TEXTURE_WRAP_S, k.CLAMP_TO_EDGE),
        k.texParameteri(a, k.TEXTURE_WRAP_T, k.CLAMP_TO_EDGE),
        k.texParameteri(a, k.TEXTURE_MAG_FILTER, C(b.magFilter)),
        k.texParameteri(a, k.TEXTURE_MIN_FILTER, C(b.minFilter)));
    if (
      lb &&
      b.type !== THREE.FloatType &&
      (1 < b.anisotropy || b.__oldAnisotropy)
    )
      k.texParameterf(
        a,
        lb.TEXTURE_MAX_ANISOTROPY_EXT,
        Math.min(b.anisotropy, dc)
      ),
        (b.__oldAnisotropy = b.anisotropy);
  }
  function V(a, b) {
    k.bindRenderbuffer(k.RENDERBUFFER, a);
    b.depthBuffer && !b.stencilBuffer
      ? (k.renderbufferStorage(
          k.RENDERBUFFER,
          k.DEPTH_COMPONENT16,
          b.width,
          b.height
        ),
        k.framebufferRenderbuffer(
          k.FRAMEBUFFER,
          k.DEPTH_ATTACHMENT,
          k.RENDERBUFFER,
          a
        ))
      : b.depthBuffer && b.stencilBuffer
      ? (k.renderbufferStorage(
          k.RENDERBUFFER,
          k.DEPTH_STENCIL,
          b.width,
          b.height
        ),
        k.framebufferRenderbuffer(
          k.FRAMEBUFFER,
          k.DEPTH_STENCIL_ATTACHMENT,
          k.RENDERBUFFER,
          a
        ))
      : k.renderbufferStorage(k.RENDERBUFFER, k.RGBA4, b.width, b.height);
  }
  function C(a) {
    return a === THREE.NearestFilter ||
      a === THREE.NearestMipMapNearestFilter ||
      a === THREE.NearestMipMapLinearFilter
      ? k.NEAREST
      : k.LINEAR;
  }
  function I(a) {
    if (a === THREE.RepeatWrapping) return k.REPEAT;
    if (a === THREE.ClampToEdgeWrapping) return k.CLAMP_TO_EDGE;
    if (a === THREE.MirroredRepeatWrapping) return k.MIRRORED_REPEAT;
    if (a === THREE.NearestFilter) return k.NEAREST;
    if (a === THREE.NearestMipMapNearestFilter) return k.NEAREST_MIPMAP_NEAREST;
    if (a === THREE.NearestMipMapLinearFilter) return k.NEAREST_MIPMAP_LINEAR;
    if (a === THREE.LinearFilter) return k.LINEAR;
    if (a === THREE.LinearMipMapNearestFilter) return k.LINEAR_MIPMAP_NEAREST;
    if (a === THREE.LinearMipMapLinearFilter) return k.LINEAR_MIPMAP_LINEAR;
    if (a === THREE.UnsignedByteType) return k.UNSIGNED_BYTE;
    if (a === THREE.UnsignedShort4444Type) return k.UNSIGNED_SHORT_4_4_4_4;
    if (a === THREE.UnsignedShort5551Type) return k.UNSIGNED_SHORT_5_5_5_1;
    if (a === THREE.UnsignedShort565Type) return k.UNSIGNED_SHORT_5_6_5;
    if (a === THREE.ByteType) return k.BYTE;
    if (a === THREE.ShortType) return k.SHORT;
    if (a === THREE.UnsignedShortType) return k.UNSIGNED_SHORT;
    if (a === THREE.IntType) return k.INT;
    if (a === THREE.UnsignedIntType) return k.UNSIGNED_INT;
    if (a === THREE.FloatType) return k.FLOAT;
    if (a === THREE.AlphaFormat) return k.ALPHA;
    if (a === THREE.RGBFormat) return k.RGB;
    if (a === THREE.RGBAFormat) return k.RGBA;
    if (a === THREE.LuminanceFormat) return k.LUMINANCE;
    if (a === THREE.LuminanceAlphaFormat) return k.LUMINANCE_ALPHA;
    if (a === THREE.AddEquation) return k.FUNC_ADD;
    if (a === THREE.SubtractEquation) return k.FUNC_SUBTRACT;
    if (a === THREE.ReverseSubtractEquation) return k.FUNC_REVERSE_SUBTRACT;
    if (a === THREE.ZeroFactor) return k.ZERO;
    if (a === THREE.OneFactor) return k.ONE;
    if (a === THREE.SrcColorFactor) return k.SRC_COLOR;
    if (a === THREE.OneMinusSrcColorFactor) return k.ONE_MINUS_SRC_COLOR;
    if (a === THREE.SrcAlphaFactor) return k.SRC_ALPHA;
    if (a === THREE.OneMinusSrcAlphaFactor) return k.ONE_MINUS_SRC_ALPHA;
    if (a === THREE.DstAlphaFactor) return k.DST_ALPHA;
    if (a === THREE.OneMinusDstAlphaFactor) return k.ONE_MINUS_DST_ALPHA;
    if (a === THREE.DstColorFactor) return k.DST_COLOR;
    if (a === THREE.OneMinusDstColorFactor) return k.ONE_MINUS_DST_COLOR;
    if (a === THREE.SrcAlphaSaturateFactor) return k.SRC_ALPHA_SATURATE;
    if (void 0 !== Va) {
      if (a === THREE.RGB_S3TC_DXT1_Format)
        return Va.COMPRESSED_RGB_S3TC_DXT1_EXT;
      if (a === THREE.RGBA_S3TC_DXT1_Format)
        return Va.COMPRESSED_RGBA_S3TC_DXT1_EXT;
      if (a === THREE.RGBA_S3TC_DXT3_Format)
        return Va.COMPRESSED_RGBA_S3TC_DXT3_EXT;
      if (a === THREE.RGBA_S3TC_DXT5_Format)
        return Va.COMPRESSED_RGBA_S3TC_DXT5_EXT;
    }
    return 0;
  }
  console.log("THREE.WebGLRenderer", THREE.REVISION);
  var a = a || {},
    M = void 0 !== a.canvas ? a.canvas : document.createElement("canvas"),
    R = void 0 !== a.precision ? a.precision : "highp",
    ea = void 0 !== a.alpha ? a.alpha : !0,
    wa = void 0 !== a.premultipliedAlpha ? a.premultipliedAlpha : !0,
    Ma = void 0 !== a.antialias ? a.antialias : !1,
    A = void 0 !== a.stencil ? a.stencil : !0,
    ca = void 0 !== a.preserveDrawingBuffer ? a.preserveDrawingBuffer : !1,
    ja = new THREE.Color(0),
    na = 0;
  void 0 !== a.clearColor &&
    (console.warn(
      "DEPRECATED: clearColor in WebGLRenderer constructor parameters is being removed. Use .setClearColor() instead."
    ),
    ja.setHex(a.clearColor));
  void 0 !== a.clearAlpha &&
    (console.warn(
      "DEPRECATED: clearAlpha in WebGLRenderer constructor parameters is being removed. Use .setClearColor() instead."
    ),
    (na = a.clearAlpha));
  this.domElement = M;
  this.context = null;
  this.devicePixelRatio =
    void 0 !== a.devicePixelRatio
      ? a.devicePixelRatio
      : void 0 !== window.devicePixelRatio
      ? window.devicePixelRatio
      : 1;
  this.autoUpdateObjects =
    this.sortObjects =
    this.autoClearStencil =
    this.autoClearDepth =
    this.autoClearColor =
    this.autoClear =
      !0;
  this.shadowMapEnabled =
    this.physicallyBasedShading =
    this.gammaOutput =
    this.gammaInput =
      !1;
  this.shadowMapAutoUpdate = !0;
  this.shadowMapType = THREE.PCFShadowMap;
  this.shadowMapCullFace = THREE.CullFaceFront;
  this.shadowMapCascade = this.shadowMapDebug = !1;
  this.maxMorphTargets = 8;
  this.maxMorphNormals = 4;
  this.autoScaleCubemaps = !0;
  this.renderPluginsPre = [];
  this.renderPluginsPost = [];
  this.info = {
    memory: { programs: 0, geometries: 0, textures: 0 },
    render: { calls: 0, vertices: 0, faces: 0, points: 0 },
  };
  var N = this,
    fa = [],
    Wa = 0,
    ab = null,
    fb = null,
    Ka = -1,
    qa = null,
    pa = null,
    Z = 0,
    ga = 0,
    W = -1,
    da = -1,
    la = -1,
    ha = -1,
    ia = -1,
    Qa = -1,
    kb = -1,
    oa = -1,
    Xa = null,
    Ra = null,
    Aa = null,
    Sa = null,
    sb = 0,
    Nb = 0,
    Kb = 0,
    Ob = 0,
    Tb = 0,
    Ub = 0,
    Ta = {},
    ua = new THREE.Frustum(),
    Ja = new THREE.Matrix4(),
    tb = new THREE.Matrix4(),
    Na = new THREE.Vector3(),
    ra = new THREE.Vector3(),
    bb = !0,
    Ab = {
      ambient: [0, 0, 0],
      directional: { length: 0, colors: [], positions: [] },
      point: { length: 0, colors: [], positions: [], distances: [] },
      spot: {
        length: 0,
        colors: [],
        positions: [],
        distances: [],
        directions: [],
        anglesCos: [],
        exponents: [],
      },
      hemi: { length: 0, skyColors: [], groundColors: [], positions: [] },
    },
    k,
    Bb,
    Ua,
    lb,
    Va;
  try {
    if (
      !(k = M.getContext("experimental-webgl", {
        alpha: ea,
        premultipliedAlpha: wa,
        antialias: Ma,
        stencil: A,
        preserveDrawingBuffer: ca,
      }))
    )
      throw "Error creating WebGL context.";
  } catch (Cb) {
    console.error(Cb);
  }
  Bb = k.getExtension("OES_texture_float");
  Ua = k.getExtension("OES_standard_derivatives");
  lb =
    k.getExtension("EXT_texture_filter_anisotropic") ||
    k.getExtension("MOZ_EXT_texture_filter_anisotropic") ||
    k.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
  Va =
    k.getExtension("WEBGL_compressed_texture_s3tc") ||
    k.getExtension("MOZ_WEBGL_compressed_texture_s3tc") ||
    k.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");
  Bb || console.log("THREE.WebGLRenderer: Float textures not supported.");
  Ua || console.log("THREE.WebGLRenderer: Standard derivatives not supported.");
  lb ||
    console.log(
      "THREE.WebGLRenderer: Anisotropic texture filtering not supported."
    );
  Va ||
    console.log("THREE.WebGLRenderer: S3TC compressed textures not supported.");
  void 0 === k.getShaderPrecisionFormat &&
    (k.getShaderPrecisionFormat = function () {
      return { rangeMin: 1, rangeMax: 1, precision: 1 };
    });
  k.clearColor(0, 0, 0, 1);
  k.clearDepth(1);
  k.clearStencil(0);
  k.enable(k.DEPTH_TEST);
  k.depthFunc(k.LEQUAL);
  k.frontFace(k.CCW);
  k.cullFace(k.BACK);
  k.enable(k.CULL_FACE);
  k.enable(k.BLEND);
  k.blendEquation(k.FUNC_ADD);
  k.blendFunc(k.SRC_ALPHA, k.ONE_MINUS_SRC_ALPHA);
  k.clearColor(ja.r, ja.g, ja.b, na);
  this.context = k;
  var cc = k.getParameter(k.MAX_TEXTURE_IMAGE_UNITS),
    Hc = k.getParameter(k.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
  k.getParameter(k.MAX_TEXTURE_SIZE);
  var Ic = k.getParameter(k.MAX_CUBE_MAP_TEXTURE_SIZE),
    dc = lb ? k.getParameter(lb.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0,
    ec = 0 < Hc,
    Vb = ec && Bb;
  Va && k.getParameter(k.COMPRESSED_TEXTURE_FORMATS);
  var Lc = k.getShaderPrecisionFormat(k.VERTEX_SHADER, k.HIGH_FLOAT),
    Mc = k.getShaderPrecisionFormat(k.VERTEX_SHADER, k.MEDIUM_FLOAT);
  k.getShaderPrecisionFormat(k.VERTEX_SHADER, k.LOW_FLOAT);
  var Nc = k.getShaderPrecisionFormat(k.FRAGMENT_SHADER, k.HIGH_FLOAT),
    Kc = k.getShaderPrecisionFormat(k.FRAGMENT_SHADER, k.MEDIUM_FLOAT);
  k.getShaderPrecisionFormat(k.FRAGMENT_SHADER, k.LOW_FLOAT);
  k.getShaderPrecisionFormat(k.VERTEX_SHADER, k.HIGH_INT);
  k.getShaderPrecisionFormat(k.VERTEX_SHADER, k.MEDIUM_INT);
  k.getShaderPrecisionFormat(k.VERTEX_SHADER, k.LOW_INT);
  k.getShaderPrecisionFormat(k.FRAGMENT_SHADER, k.HIGH_INT);
  k.getShaderPrecisionFormat(k.FRAGMENT_SHADER, k.MEDIUM_INT);
  k.getShaderPrecisionFormat(k.FRAGMENT_SHADER, k.LOW_INT);
  var Jc = 0 < Lc.precision && 0 < Nc.precision,
    fc = 0 < Mc.precision && 0 < Kc.precision;
  "highp" === R &&
    !Jc &&
    (fc
      ? ((R = "mediump"),
        console.warn("WebGLRenderer: highp not supported, using mediump"))
      : ((R = "lowp"),
        console.warn(
          "WebGLRenderer: highp and mediump not supported, using lowp"
        )));
  "mediump" === R &&
    !fc &&
    ((R = "lowp"),
    console.warn("WebGLRenderer: mediump not supported, using lowp"));
  this.getContext = function () {
    return k;
  };
  this.supportsVertexTextures = function () {
    return ec;
  };
  this.supportsFloatTextures = function () {
    return Bb;
  };
  this.supportsStandardDerivatives = function () {
    return Ua;
  };
  this.supportsCompressedTextureS3TC = function () {
    return Va;
  };
  this.getMaxAnisotropy = function () {
    return dc;
  };
  this.getPrecision = function () {
    return R;
  };
  this.setSize = function (a, b, c) {
    M.width = a * this.devicePixelRatio;
    M.height = b * this.devicePixelRatio;
    1 !== this.devicePixelRatio &&
      !1 !== c &&
      ((M.style.width = a + "px"), (M.style.height = b + "px"));
    this.setViewport(0, 0, M.width, M.height);
  };
  this.setViewport = function (a, b, c, d) {
    sb = void 0 !== a ? a : 0;
    Nb = void 0 !== b ? b : 0;
    Kb = void 0 !== c ? c : M.width;
    Ob = void 0 !== d ? d : M.height;
    k.viewport(sb, Nb, Kb, Ob);
  };
  this.setScissor = function (a, b, c, d) {
    k.scissor(a, b, c, d);
  };
  this.enableScissorTest = function (a) {
    a ? k.enable(k.SCISSOR_TEST) : k.disable(k.SCISSOR_TEST);
  };
  this.setClearColor = function (a, b) {
    ja.set(a);
    na = void 0 !== b ? b : 1;
    k.clearColor(ja.r, ja.g, ja.b, na);
  };
  this.setClearColorHex = function (a, b) {
    console.warn(
      "DEPRECATED: .setClearColorHex() is being removed. Use .setClearColor() instead."
    );
    this.setClearColor(a, b);
  };
  this.getClearColor = function () {
    return ja;
  };
  this.getClearAlpha = function () {
    return na;
  };
  this.clear = function (a, b, c) {
    var d = 0;
    if (void 0 === a || a) d |= k.COLOR_BUFFER_BIT;
    if (void 0 === b || b) d |= k.DEPTH_BUFFER_BIT;
    if (void 0 === c || c) d |= k.STENCIL_BUFFER_BIT;
    k.clear(d);
  };
  this.clearTarget = function (a, b, c, d) {
    this.setRenderTarget(a);
    this.clear(b, c, d);
  };
  this.addPostPlugin = function (a) {
    a.init(this);
    this.renderPluginsPost.push(a);
  };
  this.addPrePlugin = function (a) {
    a.init(this);
    this.renderPluginsPre.push(a);
  };
  this.updateShadowMap = function (a, b) {
    ab = null;
    Ka = qa = oa = kb = la = -1;
    bb = !0;
    da = W = -1;
    this.shadowMapPlugin.update(a, b);
  };
  var gc = function (a) {
      a = a.target;
      a.removeEventListener("dispose", gc);
      a.__webglInit = void 0;
      void 0 !== a.__webglVertexBuffer && k.deleteBuffer(a.__webglVertexBuffer);
      void 0 !== a.__webglNormalBuffer && k.deleteBuffer(a.__webglNormalBuffer);
      void 0 !== a.__webglTangentBuffer &&
        k.deleteBuffer(a.__webglTangentBuffer);
      void 0 !== a.__webglColorBuffer && k.deleteBuffer(a.__webglColorBuffer);
      void 0 !== a.__webglUVBuffer && k.deleteBuffer(a.__webglUVBuffer);
      void 0 !== a.__webglUV2Buffer && k.deleteBuffer(a.__webglUV2Buffer);
      void 0 !== a.__webglSkinIndicesBuffer &&
        k.deleteBuffer(a.__webglSkinIndicesBuffer);
      void 0 !== a.__webglSkinWeightsBuffer &&
        k.deleteBuffer(a.__webglSkinWeightsBuffer);
      void 0 !== a.__webglFaceBuffer && k.deleteBuffer(a.__webglFaceBuffer);
      void 0 !== a.__webglLineBuffer && k.deleteBuffer(a.__webglLineBuffer);
      void 0 !== a.__webglLineDistanceBuffer &&
        k.deleteBuffer(a.__webglLineDistanceBuffer);
      if (void 0 !== a.geometryGroups)
        for (var c in a.geometryGroups) {
          var d = a.geometryGroups[c];
          if (void 0 !== d.numMorphTargets)
            for (var e = 0, f = d.numMorphTargets; e < f; e++)
              k.deleteBuffer(d.__webglMorphTargetsBuffers[e]);
          if (void 0 !== d.numMorphNormals) {
            e = 0;
            for (f = d.numMorphNormals; e < f; e++)
              k.deleteBuffer(d.__webglMorphNormalsBuffers[e]);
          }
          b(d);
        }
      b(a);
      N.info.memory.geometries--;
    },
    oc = function (a) {
      a = a.target;
      a.removeEventListener("dispose", oc);
      a.image && a.image.__webglTextureCube
        ? k.deleteTexture(a.image.__webglTextureCube)
        : a.__webglInit &&
          ((a.__webglInit = !1), k.deleteTexture(a.__webglTexture));
      N.info.memory.textures--;
    },
    U = function (a) {
      a = a.target;
      a.removeEventListener("dispose", U);
      if (a && a.__webglTexture)
        if (
          (k.deleteTexture(a.__webglTexture),
          a instanceof THREE.WebGLRenderTargetCube)
        )
          for (var b = 0; 6 > b; b++)
            k.deleteFramebuffer(a.__webglFramebuffer[b]),
              k.deleteRenderbuffer(a.__webglRenderbuffer[b]);
        else
          k.deleteFramebuffer(a.__webglFramebuffer),
            k.deleteRenderbuffer(a.__webglRenderbuffer);
      N.info.memory.textures--;
    },
    P = function (a) {
      a = a.target;
      a.removeEventListener("dispose", P);
      pc(a);
    },
    pc = function (a) {
      var b = a.program;
      if (void 0 !== b) {
        a.program = void 0;
        var c,
          d,
          e = !1,
          a = 0;
        for (c = fa.length; a < c; a++)
          if (((d = fa[a]), d.program === b)) {
            d.usedTimes--;
            0 === d.usedTimes && (e = !0);
            break;
          }
        if (!0 === e) {
          e = [];
          a = 0;
          for (c = fa.length; a < c; a++)
            (d = fa[a]), d.program !== b && e.push(d);
          fa = e;
          k.deleteProgram(b);
          N.info.memory.programs--;
        }
      }
    };
  this.renderBufferImmediate = function (a, b, c) {
    a.hasPositions &&
      !a.__webglVertexBuffer &&
      (a.__webglVertexBuffer = k.createBuffer());
    a.hasNormals &&
      !a.__webglNormalBuffer &&
      (a.__webglNormalBuffer = k.createBuffer());
    a.hasUvs && !a.__webglUvBuffer && (a.__webglUvBuffer = k.createBuffer());
    a.hasColors &&
      !a.__webglColorBuffer &&
      (a.__webglColorBuffer = k.createBuffer());
    a.hasPositions &&
      (k.bindBuffer(k.ARRAY_BUFFER, a.__webglVertexBuffer),
      k.bufferData(k.ARRAY_BUFFER, a.positionArray, k.DYNAMIC_DRAW),
      k.enableVertexAttribArray(b.attributes.position),
      k.vertexAttribPointer(b.attributes.position, 3, k.FLOAT, !1, 0, 0));
    if (a.hasNormals) {
      k.bindBuffer(k.ARRAY_BUFFER, a.__webglNormalBuffer);
      if (c.shading === THREE.FlatShading) {
        var d,
          e,
          f,
          g,
          h,
          i,
          j,
          l,
          p,
          m,
          n,
          q = 3 * a.count;
        for (n = 0; n < q; n += 9)
          (m = a.normalArray),
            (d = m[n]),
            (e = m[n + 1]),
            (f = m[n + 2]),
            (g = m[n + 3]),
            (i = m[n + 4]),
            (l = m[n + 5]),
            (h = m[n + 6]),
            (j = m[n + 7]),
            (p = m[n + 8]),
            (d = (d + g + h) / 3),
            (e = (e + i + j) / 3),
            (f = (f + l + p) / 3),
            (m[n] = d),
            (m[n + 1] = e),
            (m[n + 2] = f),
            (m[n + 3] = d),
            (m[n + 4] = e),
            (m[n + 5] = f),
            (m[n + 6] = d),
            (m[n + 7] = e),
            (m[n + 8] = f);
      }
      k.bufferData(k.ARRAY_BUFFER, a.normalArray, k.DYNAMIC_DRAW);
      k.enableVertexAttribArray(b.attributes.normal);
      k.vertexAttribPointer(b.attributes.normal, 3, k.FLOAT, !1, 0, 0);
    }
    a.hasUvs &&
      c.map &&
      (k.bindBuffer(k.ARRAY_BUFFER, a.__webglUvBuffer),
      k.bufferData(k.ARRAY_BUFFER, a.uvArray, k.DYNAMIC_DRAW),
      k.enableVertexAttribArray(b.attributes.uv),
      k.vertexAttribPointer(b.attributes.uv, 2, k.FLOAT, !1, 0, 0));
    a.hasColors &&
      c.vertexColors !== THREE.NoColors &&
      (k.bindBuffer(k.ARRAY_BUFFER, a.__webglColorBuffer),
      k.bufferData(k.ARRAY_BUFFER, a.colorArray, k.DYNAMIC_DRAW),
      k.enableVertexAttribArray(b.attributes.color),
      k.vertexAttribPointer(b.attributes.color, 3, k.FLOAT, !1, 0, 0));
    k.drawArrays(k.TRIANGLES, 0, a.count);
    a.count = 0;
  };
  this.renderBufferDirect = function (a, b, c, d, e, f) {
    if (!1 !== d.visible) {
      var g, j, l;
      g = E(a, b, c, d, f);
      a = g.attributes;
      b = e.attributes;
      c = !1;
      g = 16777215 * e.id + 2 * g.id + (d.wireframe ? 1 : 0);
      g !== qa && ((qa = g), (c = !0));
      c && i();
      if (f instanceof THREE.Mesh)
        if ((d = b.index)) {
          e = e.offsets;
          1 < e.length && (c = !0);
          for (var p = 0, m = e.length; p < m; p++) {
            var n = e[p].index;
            if (c) {
              for (j in b)
                "index" !== j &&
                  ((g = a[j]),
                  (f = b[j]),
                  (l = f.itemSize),
                  0 <= g &&
                    (k.bindBuffer(k.ARRAY_BUFFER, f.buffer),
                    h(g),
                    k.vertexAttribPointer(g, l, k.FLOAT, !1, 0, 4 * n * l)));
              k.bindBuffer(k.ELEMENT_ARRAY_BUFFER, d.buffer);
            }
            k.drawElements(
              k.TRIANGLES,
              e[p].count,
              k.UNSIGNED_SHORT,
              2 * e[p].start
            );
            N.info.render.calls++;
            N.info.render.vertices += e[p].count;
            N.info.render.faces += e[p].count / 3;
          }
        } else {
          if (c)
            for (j in b)
              "index" !== j &&
                ((g = a[j]),
                (f = b[j]),
                (l = f.itemSize),
                0 <= g &&
                  (k.bindBuffer(k.ARRAY_BUFFER, f.buffer),
                  h(g),
                  k.vertexAttribPointer(g, l, k.FLOAT, !1, 0, 0)));
          j = e.attributes.position;
          k.drawArrays(k.TRIANGLES, 0, j.numItems / 3);
          N.info.render.calls++;
          N.info.render.vertices += j.numItems / 3;
          N.info.render.faces += j.numItems / 3 / 3;
        }
      else if (f instanceof THREE.ParticleSystem) {
        if (c) {
          for (j in b)
            (g = a[j]),
              (f = b[j]),
              (l = f.itemSize),
              0 <= g &&
                (k.bindBuffer(k.ARRAY_BUFFER, f.buffer),
                h(g),
                k.vertexAttribPointer(g, l, k.FLOAT, !1, 0, 0));
          j = b.position;
          k.drawArrays(k.POINTS, 0, j.numItems / 3);
          N.info.render.calls++;
          N.info.render.points += j.numItems / 3;
        }
      } else if (f instanceof THREE.Line && c) {
        for (j in b)
          (g = a[j]),
            (f = b[j]),
            (l = f.itemSize),
            0 <= g &&
              (k.bindBuffer(k.ARRAY_BUFFER, f.buffer),
              h(g),
              k.vertexAttribPointer(g, l, k.FLOAT, !1, 0, 0));
        H(d.linewidth);
        j = b.position;
        k.drawArrays(k.LINE_STRIP, 0, j.numItems / 3);
        N.info.render.calls++;
        N.info.render.points += j.numItems;
      }
    }
  };
  this.renderBuffer = function (a, b, c, d, e, f) {
    if (!1 !== d.visible) {
      var g,
        j,
        c = E(a, b, c, d, f),
        a = c.attributes,
        b = !1,
        c = 16777215 * e.id + 2 * c.id + (d.wireframe ? 1 : 0);
      c !== qa && ((qa = c), (b = !0));
      b && i();
      if (!d.morphTargets && 0 <= a.position)
        b &&
          (k.bindBuffer(k.ARRAY_BUFFER, e.__webglVertexBuffer),
          h(a.position),
          k.vertexAttribPointer(a.position, 3, k.FLOAT, !1, 0, 0));
      else if (f.morphTargetBase) {
        c = d.program.attributes;
        -1 !== f.morphTargetBase && 0 <= c.position
          ? (k.bindBuffer(
              k.ARRAY_BUFFER,
              e.__webglMorphTargetsBuffers[f.morphTargetBase]
            ),
            h(c.position),
            k.vertexAttribPointer(c.position, 3, k.FLOAT, !1, 0, 0))
          : 0 <= c.position &&
            (k.bindBuffer(k.ARRAY_BUFFER, e.__webglVertexBuffer),
            h(c.position),
            k.vertexAttribPointer(c.position, 3, k.FLOAT, !1, 0, 0));
        if (f.morphTargetForcedOrder.length) {
          var l = 0;
          j = f.morphTargetForcedOrder;
          for (
            g = f.morphTargetInfluences;
            l < d.numSupportedMorphTargets && l < j.length;

          )
            0 <= c["morphTarget" + l] &&
              (k.bindBuffer(k.ARRAY_BUFFER, e.__webglMorphTargetsBuffers[j[l]]),
              h(c["morphTarget" + l]),
              k.vertexAttribPointer(
                c["morphTarget" + l],
                3,
                k.FLOAT,
                !1,
                0,
                0
              )),
              0 <= c["morphNormal" + l] &&
                d.morphNormals &&
                (k.bindBuffer(
                  k.ARRAY_BUFFER,
                  e.__webglMorphNormalsBuffers[j[l]]
                ),
                h(c["morphNormal" + l]),
                k.vertexAttribPointer(
                  c["morphNormal" + l],
                  3,
                  k.FLOAT,
                  !1,
                  0,
                  0
                )),
              (f.__webglMorphTargetInfluences[l] = g[j[l]]),
              l++;
        } else {
          j = [];
          g = f.morphTargetInfluences;
          var p,
            n = g.length;
          for (p = 0; p < n; p++) (l = g[p]), 0 < l && j.push([l, p]);
          j.length > d.numSupportedMorphTargets
            ? (j.sort(m), (j.length = d.numSupportedMorphTargets))
            : j.length > d.numSupportedMorphNormals
            ? j.sort(m)
            : 0 === j.length && j.push([0, 0]);
          for (l = 0; l < d.numSupportedMorphTargets; )
            j[l]
              ? ((p = j[l][1]),
                0 <= c["morphTarget" + l] &&
                  (k.bindBuffer(
                    k.ARRAY_BUFFER,
                    e.__webglMorphTargetsBuffers[p]
                  ),
                  h(c["morphTarget" + l]),
                  k.vertexAttribPointer(
                    c["morphTarget" + l],
                    3,
                    k.FLOAT,
                    !1,
                    0,
                    0
                  )),
                0 <= c["morphNormal" + l] &&
                  d.morphNormals &&
                  (k.bindBuffer(
                    k.ARRAY_BUFFER,
                    e.__webglMorphNormalsBuffers[p]
                  ),
                  h(c["morphNormal" + l]),
                  k.vertexAttribPointer(
                    c["morphNormal" + l],
                    3,
                    k.FLOAT,
                    !1,
                    0,
                    0
                  )),
                (f.__webglMorphTargetInfluences[l] = g[p]))
              : (f.__webglMorphTargetInfluences[l] = 0),
              l++;
        }
        null !== d.program.uniforms.morphTargetInfluences &&
          k.uniform1fv(
            d.program.uniforms.morphTargetInfluences,
            f.__webglMorphTargetInfluences
          );
      }
      if (b) {
        if (e.__webglCustomAttributesList) {
          g = 0;
          for (j = e.__webglCustomAttributesList.length; g < j; g++)
            (c = e.__webglCustomAttributesList[g]),
              0 <= a[c.buffer.belongsToAttribute] &&
                (k.bindBuffer(k.ARRAY_BUFFER, c.buffer),
                h(a[c.buffer.belongsToAttribute]),
                k.vertexAttribPointer(
                  a[c.buffer.belongsToAttribute],
                  c.size,
                  k.FLOAT,
                  !1,
                  0,
                  0
                ));
        }
        0 <= a.color &&
          (k.bindBuffer(k.ARRAY_BUFFER, e.__webglColorBuffer),
          h(a.color),
          k.vertexAttribPointer(a.color, 3, k.FLOAT, !1, 0, 0));
        0 <= a.normal &&
          (k.bindBuffer(k.ARRAY_BUFFER, e.__webglNormalBuffer),
          h(a.normal),
          k.vertexAttribPointer(a.normal, 3, k.FLOAT, !1, 0, 0));
        0 <= a.tangent &&
          (k.bindBuffer(k.ARRAY_BUFFER, e.__webglTangentBuffer),
          h(a.tangent),
          k.vertexAttribPointer(a.tangent, 4, k.FLOAT, !1, 0, 0));
        0 <= a.uv &&
          (k.bindBuffer(k.ARRAY_BUFFER, e.__webglUVBuffer),
          h(a.uv),
          k.vertexAttribPointer(a.uv, 2, k.FLOAT, !1, 0, 0));
        0 <= a.uv2 &&
          (k.bindBuffer(k.ARRAY_BUFFER, e.__webglUV2Buffer),
          h(a.uv2),
          k.vertexAttribPointer(a.uv2, 2, k.FLOAT, !1, 0, 0));
        d.skinning &&
          0 <= a.skinIndex &&
          0 <= a.skinWeight &&
          (k.bindBuffer(k.ARRAY_BUFFER, e.__webglSkinIndicesBuffer),
          h(a.skinIndex),
          k.vertexAttribPointer(a.skinIndex, 4, k.FLOAT, !1, 0, 0),
          k.bindBuffer(k.ARRAY_BUFFER, e.__webglSkinWeightsBuffer),
          h(a.skinWeight),
          k.vertexAttribPointer(a.skinWeight, 4, k.FLOAT, !1, 0, 0));
        0 <= a.lineDistance &&
          (k.bindBuffer(k.ARRAY_BUFFER, e.__webglLineDistanceBuffer),
          h(a.lineDistance),
          k.vertexAttribPointer(a.lineDistance, 1, k.FLOAT, !1, 0, 0));
      }
      f instanceof THREE.Mesh
        ? (d.wireframe
            ? (H(d.wireframeLinewidth),
              b && k.bindBuffer(k.ELEMENT_ARRAY_BUFFER, e.__webglLineBuffer),
              k.drawElements(k.LINES, e.__webglLineCount, k.UNSIGNED_SHORT, 0))
            : (b && k.bindBuffer(k.ELEMENT_ARRAY_BUFFER, e.__webglFaceBuffer),
              k.drawElements(
                k.TRIANGLES,
                e.__webglFaceCount,
                k.UNSIGNED_SHORT,
                0
              )),
          N.info.render.calls++,
          (N.info.render.vertices += e.__webglFaceCount),
          (N.info.render.faces += e.__webglFaceCount / 3))
        : f instanceof THREE.Line
        ? ((f = f.type === THREE.LineStrip ? k.LINE_STRIP : k.LINES),
          H(d.linewidth),
          k.drawArrays(f, 0, e.__webglLineCount),
          N.info.render.calls++)
        : f instanceof THREE.ParticleSystem
        ? (k.drawArrays(k.POINTS, 0, e.__webglParticleCount),
          N.info.render.calls++,
          (N.info.render.points += e.__webglParticleCount))
        : f instanceof THREE.Ribbon &&
          (k.drawArrays(k.TRIANGLE_STRIP, 0, e.__webglVertexCount),
          N.info.render.calls++);
    }
  };
  this.render = function (a, b, c, d) {
    if (!1 === b instanceof THREE.Camera)
      console.error(
        "THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera."
      );
    else {
      var e,
        f,
        g,
        h,
        i = a.__lights,
        m = a.fog;
      Ka = -1;
      bb = !0;
      !0 === a.autoUpdate && a.updateMatrixWorld();
      void 0 === b.parent && b.updateMatrixWorld();
      b.matrixWorldInverse.getInverse(b.matrixWorld);
      Ja.multiplyMatrices(b.projectionMatrix, b.matrixWorldInverse);
      ua.setFromMatrix(Ja);
      this.autoUpdateObjects && this.initWebGLObjects(a);
      p(this.renderPluginsPre, a, b);
      N.info.render.calls = 0;
      N.info.render.vertices = 0;
      N.info.render.faces = 0;
      N.info.render.points = 0;
      this.setRenderTarget(c);
      (this.autoClear || d) &&
        this.clear(
          this.autoClearColor,
          this.autoClearDepth,
          this.autoClearStencil
        );
      h = a.__webglObjects;
      d = 0;
      for (e = h.length; d < e; d++)
        if (
          ((f = h[d]),
          (g = f.object),
          (f.id = d),
          (f.render = !1),
          g.visible &&
            (!(g instanceof THREE.Mesh || g instanceof THREE.ParticleSystem) ||
              !g.frustumCulled ||
              ua.intersectsObject(g)))
        ) {
          var n = g;
          n._modelViewMatrix.multiplyMatrices(
            b.matrixWorldInverse,
            n.matrixWorld
          );
          n._normalMatrix.getNormalMatrix(n._modelViewMatrix);
          var n = f,
            q = n.buffer,
            s = void 0,
            t = (s = void 0),
            t = n.object.material;
          if (t instanceof THREE.MeshFaceMaterial)
            (s = q.materialIndex),
              (s = t.materials[s]),
              s.transparent
                ? ((n.transparent = s), (n.opaque = null))
                : ((n.opaque = s), (n.transparent = null));
          else if ((s = t))
            s.transparent
              ? ((n.transparent = s), (n.opaque = null))
              : ((n.opaque = s), (n.transparent = null));
          f.render = !0;
          !0 === this.sortObjects &&
            (null !== g.renderDepth
              ? (f.z = g.renderDepth)
              : (Na.getPositionFromMatrix(g.matrixWorld),
                Na.applyProjection(Ja),
                (f.z = Na.z)));
        }
      this.sortObjects && h.sort(j);
      h = a.__webglObjectsImmediate;
      d = 0;
      for (e = h.length; d < e; d++)
        (f = h[d]),
          (g = f.object),
          g.visible &&
            (g._modelViewMatrix.multiplyMatrices(
              b.matrixWorldInverse,
              g.matrixWorld
            ),
            g._normalMatrix.getNormalMatrix(g._modelViewMatrix),
            (g = f.object.material),
            g.transparent
              ? ((f.transparent = g), (f.opaque = null))
              : ((f.opaque = g), (f.transparent = null)));
      a.overrideMaterial
        ? ((d = a.overrideMaterial),
          this.setBlending(d.blending, d.blendEquation, d.blendSrc, d.blendDst),
          this.setDepthTest(d.depthTest),
          this.setDepthWrite(d.depthWrite),
          K(d.polygonOffset, d.polygonOffsetFactor, d.polygonOffsetUnits),
          l(a.__webglObjects, !1, "", b, i, m, !0, d),
          r(a.__webglObjectsImmediate, "", b, i, m, !1, d))
        : ((d = null),
          this.setBlending(THREE.NoBlending),
          l(a.__webglObjects, !0, "opaque", b, i, m, !1, d),
          r(a.__webglObjectsImmediate, "opaque", b, i, m, !1, d),
          l(a.__webglObjects, !1, "transparent", b, i, m, !0, d),
          r(a.__webglObjectsImmediate, "transparent", b, i, m, !0, d));
      p(this.renderPluginsPost, a, b);
      c &&
        c.generateMipmaps &&
        c.minFilter !== THREE.NearestFilter &&
        c.minFilter !== THREE.LinearFilter &&
        (c instanceof THREE.WebGLRenderTargetCube
          ? (k.bindTexture(k.TEXTURE_CUBE_MAP, c.__webglTexture),
            k.generateMipmap(k.TEXTURE_CUBE_MAP),
            k.bindTexture(k.TEXTURE_CUBE_MAP, null))
          : (k.bindTexture(k.TEXTURE_2D, c.__webglTexture),
            k.generateMipmap(k.TEXTURE_2D),
            k.bindTexture(k.TEXTURE_2D, null)));
      this.setDepthTest(!0);
      this.setDepthWrite(!0);
    }
  };
  this.renderImmediateObject = function (a, b, c, d, e) {
    var f = E(a, b, c, d, e);
    qa = -1;
    N.setMaterialFaces(d);
    e.immediateRenderCallback
      ? e.immediateRenderCallback(f, k, ua)
      : e.render(function (a) {
          N.renderBufferImmediate(a, f, d);
        });
  };
  this.initWebGLObjects = function (a) {
    a.__webglObjects ||
      ((a.__webglObjects = []),
      (a.__webglObjectsImmediate = []),
      (a.__webglSprites = []),
      (a.__webglFlares = []));
    for (; a.__objectsAdded.length; )
      s(a.__objectsAdded[0], a), a.__objectsAdded.splice(0, 1);
    for (; a.__objectsRemoved.length; )
      u(a.__objectsRemoved[0], a), a.__objectsRemoved.splice(0, 1);
    for (var b = 0, c = a.__webglObjects.length; b < c; b++) {
      var h = a.__webglObjects[b].object;
      void 0 === h.__webglInit &&
        (void 0 !== h.__webglActive && u(h, a), s(h, a));
      var i = h,
        j = i.geometry,
        l = void 0,
        p = void 0,
        n = void 0;
      if (j instanceof THREE.BufferGeometry) {
        var r = k.DYNAMIC_DRAW,
          t = !j.dynamic,
          x = j.attributes,
          z = void 0,
          B = void 0;
        for (z in x)
          (B = x[z]),
            B.needsUpdate &&
              ("index" === z
                ? (k.bindBuffer(k.ELEMENT_ARRAY_BUFFER, B.buffer),
                  k.bufferData(k.ELEMENT_ARRAY_BUFFER, B.array, r))
                : (k.bindBuffer(k.ARRAY_BUFFER, B.buffer),
                  k.bufferData(k.ARRAY_BUFFER, B.array, r)),
              (B.needsUpdate = !1)),
            t && !B.dynamic && delete B.array;
      } else if (i instanceof THREE.Mesh) {
        for (var E = 0, F = j.geometryGroupsList.length; E < F; E++)
          if (
            ((l = j.geometryGroupsList[E]),
            (n = e(i, l)),
            j.buffersNeedUpdate && d(l, i),
            (p = n.attributes && q(n)),
            j.verticesNeedUpdate ||
              j.morphTargetsNeedUpdate ||
              j.elementsNeedUpdate ||
              j.uvsNeedUpdate ||
              j.normalsNeedUpdate ||
              j.colorsNeedUpdate ||
              j.tangentsNeedUpdate ||
              p)
          ) {
            var C = l,
              J = i,
              G = k.DYNAMIC_DRAW,
              I = !j.dynamic,
              H = n;
            if (C.__inittedArrays) {
              var L = f(H),
                K = H.vertexColors ? H.vertexColors : !1,
                N = g(H),
                M = L === THREE.SmoothShading,
                D = void 0,
                A = void 0,
                fa = void 0,
                O = void 0,
                U = void 0,
                R = void 0,
                P = void 0,
                V = void 0,
                W = void 0,
                Z = void 0,
                da = void 0,
                S = void 0,
                T = void 0,
                Q = void 0,
                aa = void 0,
                ga = void 0,
                pa = void 0,
                ca = void 0,
                ab = void 0,
                ea = void 0,
                ha = void 0,
                ia = void 0,
                la = void 0,
                Wa = void 0,
                ja = void 0,
                qa = void 0,
                na = void 0,
                oa = void 0,
                Ka = void 0,
                fb = void 0,
                wa = void 0,
                ra = void 0,
                ua = void 0,
                Aa = void 0,
                Qa = void 0,
                va = void 0,
                bb = void 0,
                Ma = void 0,
                Ua = void 0,
                Xa = void 0,
                cb = void 0,
                kb = void 0,
                Za = void 0,
                $a = void 0,
                Ra = void 0,
                Sa = void 0,
                La = 0,
                Pa = 0,
                Ta = 0,
                Va = 0,
                wb = 0,
                ib = 0,
                Ba = 0,
                nb = 0,
                Oa = 0,
                Y = 0,
                ka = 0,
                w = 0,
                ya = void 0,
                db = C.__vertexArray,
                lb = C.__uvArray,
                sb = C.__uv2Array,
                xb = C.__normalArray,
                Fa = C.__tangentArray,
                eb = C.__colorArray,
                Ga = C.__skinIndexArray,
                Ha = C.__skinWeightArray,
                Ab = C.__morphTargetsArrays,
                Bb = C.__morphNormalsArrays,
                Cb = C.__webglCustomAttributesList,
                v = void 0,
                Fb = C.__faceArray,
                ub = C.__lineArray,
                ob = J.geometry,
                Nb = ob.elementsNeedUpdate,
                Kb = ob.uvsNeedUpdate,
                Ob = ob.normalsNeedUpdate,
                Tb = ob.tangentsNeedUpdate,
                Ub = ob.colorsNeedUpdate,
                ec = ob.morphTargetsNeedUpdate,
                Wb = ob.vertices,
                sa = C.faces3,
                ta = C.faces4,
                jb = ob.faces,
                Vb = ob.faceVertexUvs[0],
                Qc = ob.faceVertexUvs[1],
                Xb = ob.skinIndices,
                Qb = ob.skinWeights,
                Rb = ob.morphTargets,
                rc = ob.morphNormals;
              if (ob.verticesNeedUpdate) {
                D = 0;
                for (A = sa.length; D < A; D++)
                  (O = jb[sa[D]]),
                    (S = Wb[O.a]),
                    (T = Wb[O.b]),
                    (Q = Wb[O.c]),
                    (db[Pa] = S.x),
                    (db[Pa + 1] = S.y),
                    (db[Pa + 2] = S.z),
                    (db[Pa + 3] = T.x),
                    (db[Pa + 4] = T.y),
                    (db[Pa + 5] = T.z),
                    (db[Pa + 6] = Q.x),
                    (db[Pa + 7] = Q.y),
                    (db[Pa + 8] = Q.z),
                    (Pa += 9);
                D = 0;
                for (A = ta.length; D < A; D++)
                  (O = jb[ta[D]]),
                    (S = Wb[O.a]),
                    (T = Wb[O.b]),
                    (Q = Wb[O.c]),
                    (aa = Wb[O.d]),
                    (db[Pa] = S.x),
                    (db[Pa + 1] = S.y),
                    (db[Pa + 2] = S.z),
                    (db[Pa + 3] = T.x),
                    (db[Pa + 4] = T.y),
                    (db[Pa + 5] = T.z),
                    (db[Pa + 6] = Q.x),
                    (db[Pa + 7] = Q.y),
                    (db[Pa + 8] = Q.z),
                    (db[Pa + 9] = aa.x),
                    (db[Pa + 10] = aa.y),
                    (db[Pa + 11] = aa.z),
                    (Pa += 12);
                k.bindBuffer(k.ARRAY_BUFFER, C.__webglVertexBuffer);
                k.bufferData(k.ARRAY_BUFFER, db, G);
              }
              if (ec) {
                cb = 0;
                for (kb = Rb.length; cb < kb; cb++) {
                  D = ka = 0;
                  for (A = sa.length; D < A; D++)
                    (Ra = sa[D]),
                      (O = jb[Ra]),
                      (S = Rb[cb].vertices[O.a]),
                      (T = Rb[cb].vertices[O.b]),
                      (Q = Rb[cb].vertices[O.c]),
                      (Za = Ab[cb]),
                      (Za[ka] = S.x),
                      (Za[ka + 1] = S.y),
                      (Za[ka + 2] = S.z),
                      (Za[ka + 3] = T.x),
                      (Za[ka + 4] = T.y),
                      (Za[ka + 5] = T.z),
                      (Za[ka + 6] = Q.x),
                      (Za[ka + 7] = Q.y),
                      (Za[ka + 8] = Q.z),
                      H.morphNormals &&
                        (M
                          ? ((Sa = rc[cb].vertexNormals[Ra]),
                            (ea = Sa.a),
                            (ha = Sa.b),
                            (ia = Sa.c))
                          : (ia = ha = ea = rc[cb].faceNormals[Ra]),
                        ($a = Bb[cb]),
                        ($a[ka] = ea.x),
                        ($a[ka + 1] = ea.y),
                        ($a[ka + 2] = ea.z),
                        ($a[ka + 3] = ha.x),
                        ($a[ka + 4] = ha.y),
                        ($a[ka + 5] = ha.z),
                        ($a[ka + 6] = ia.x),
                        ($a[ka + 7] = ia.y),
                        ($a[ka + 8] = ia.z)),
                      (ka += 9);
                  D = 0;
                  for (A = ta.length; D < A; D++)
                    (Ra = ta[D]),
                      (O = jb[Ra]),
                      (S = Rb[cb].vertices[O.a]),
                      (T = Rb[cb].vertices[O.b]),
                      (Q = Rb[cb].vertices[O.c]),
                      (aa = Rb[cb].vertices[O.d]),
                      (Za = Ab[cb]),
                      (Za[ka] = S.x),
                      (Za[ka + 1] = S.y),
                      (Za[ka + 2] = S.z),
                      (Za[ka + 3] = T.x),
                      (Za[ka + 4] = T.y),
                      (Za[ka + 5] = T.z),
                      (Za[ka + 6] = Q.x),
                      (Za[ka + 7] = Q.y),
                      (Za[ka + 8] = Q.z),
                      (Za[ka + 9] = aa.x),
                      (Za[ka + 10] = aa.y),
                      (Za[ka + 11] = aa.z),
                      H.morphNormals &&
                        (M
                          ? ((Sa = rc[cb].vertexNormals[Ra]),
                            (ea = Sa.a),
                            (ha = Sa.b),
                            (ia = Sa.c),
                            (la = Sa.d))
                          : (la = ia = ha = ea = rc[cb].faceNormals[Ra]),
                        ($a = Bb[cb]),
                        ($a[ka] = ea.x),
                        ($a[ka + 1] = ea.y),
                        ($a[ka + 2] = ea.z),
                        ($a[ka + 3] = ha.x),
                        ($a[ka + 4] = ha.y),
                        ($a[ka + 5] = ha.z),
                        ($a[ka + 6] = ia.x),
                        ($a[ka + 7] = ia.y),
                        ($a[ka + 8] = ia.z),
                        ($a[ka + 9] = la.x),
                        ($a[ka + 10] = la.y),
                        ($a[ka + 11] = la.z)),
                      (ka += 12);
                  k.bindBuffer(
                    k.ARRAY_BUFFER,
                    C.__webglMorphTargetsBuffers[cb]
                  );
                  k.bufferData(k.ARRAY_BUFFER, Ab[cb], G);
                  H.morphNormals &&
                    (k.bindBuffer(
                      k.ARRAY_BUFFER,
                      C.__webglMorphNormalsBuffers[cb]
                    ),
                    k.bufferData(k.ARRAY_BUFFER, Bb[cb], G));
                }
              }
              if (Qb.length) {
                D = 0;
                for (A = sa.length; D < A; D++)
                  (O = jb[sa[D]]),
                    (oa = Qb[O.a]),
                    (Ka = Qb[O.b]),
                    (fb = Qb[O.c]),
                    (Ha[Y] = oa.x),
                    (Ha[Y + 1] = oa.y),
                    (Ha[Y + 2] = oa.z),
                    (Ha[Y + 3] = oa.w),
                    (Ha[Y + 4] = Ka.x),
                    (Ha[Y + 5] = Ka.y),
                    (Ha[Y + 6] = Ka.z),
                    (Ha[Y + 7] = Ka.w),
                    (Ha[Y + 8] = fb.x),
                    (Ha[Y + 9] = fb.y),
                    (Ha[Y + 10] = fb.z),
                    (Ha[Y + 11] = fb.w),
                    (ra = Xb[O.a]),
                    (ua = Xb[O.b]),
                    (Aa = Xb[O.c]),
                    (Ga[Y] = ra.x),
                    (Ga[Y + 1] = ra.y),
                    (Ga[Y + 2] = ra.z),
                    (Ga[Y + 3] = ra.w),
                    (Ga[Y + 4] = ua.x),
                    (Ga[Y + 5] = ua.y),
                    (Ga[Y + 6] = ua.z),
                    (Ga[Y + 7] = ua.w),
                    (Ga[Y + 8] = Aa.x),
                    (Ga[Y + 9] = Aa.y),
                    (Ga[Y + 10] = Aa.z),
                    (Ga[Y + 11] = Aa.w),
                    (Y += 12);
                D = 0;
                for (A = ta.length; D < A; D++)
                  (O = jb[ta[D]]),
                    (oa = Qb[O.a]),
                    (Ka = Qb[O.b]),
                    (fb = Qb[O.c]),
                    (wa = Qb[O.d]),
                    (Ha[Y] = oa.x),
                    (Ha[Y + 1] = oa.y),
                    (Ha[Y + 2] = oa.z),
                    (Ha[Y + 3] = oa.w),
                    (Ha[Y + 4] = Ka.x),
                    (Ha[Y + 5] = Ka.y),
                    (Ha[Y + 6] = Ka.z),
                    (Ha[Y + 7] = Ka.w),
                    (Ha[Y + 8] = fb.x),
                    (Ha[Y + 9] = fb.y),
                    (Ha[Y + 10] = fb.z),
                    (Ha[Y + 11] = fb.w),
                    (Ha[Y + 12] = wa.x),
                    (Ha[Y + 13] = wa.y),
                    (Ha[Y + 14] = wa.z),
                    (Ha[Y + 15] = wa.w),
                    (ra = Xb[O.a]),
                    (ua = Xb[O.b]),
                    (Aa = Xb[O.c]),
                    (Qa = Xb[O.d]),
                    (Ga[Y] = ra.x),
                    (Ga[Y + 1] = ra.y),
                    (Ga[Y + 2] = ra.z),
                    (Ga[Y + 3] = ra.w),
                    (Ga[Y + 4] = ua.x),
                    (Ga[Y + 5] = ua.y),
                    (Ga[Y + 6] = ua.z),
                    (Ga[Y + 7] = ua.w),
                    (Ga[Y + 8] = Aa.x),
                    (Ga[Y + 9] = Aa.y),
                    (Ga[Y + 10] = Aa.z),
                    (Ga[Y + 11] = Aa.w),
                    (Ga[Y + 12] = Qa.x),
                    (Ga[Y + 13] = Qa.y),
                    (Ga[Y + 14] = Qa.z),
                    (Ga[Y + 15] = Qa.w),
                    (Y += 16);
                0 < Y &&
                  (k.bindBuffer(k.ARRAY_BUFFER, C.__webglSkinIndicesBuffer),
                  k.bufferData(k.ARRAY_BUFFER, Ga, G),
                  k.bindBuffer(k.ARRAY_BUFFER, C.__webglSkinWeightsBuffer),
                  k.bufferData(k.ARRAY_BUFFER, Ha, G));
              }
              if (Ub && K) {
                D = 0;
                for (A = sa.length; D < A; D++)
                  (O = jb[sa[D]]),
                    (P = O.vertexColors),
                    (V = O.color),
                    3 === P.length && K === THREE.VertexColors
                      ? ((Wa = P[0]), (ja = P[1]), (qa = P[2]))
                      : (qa = ja = Wa = V),
                    (eb[Oa] = Wa.r),
                    (eb[Oa + 1] = Wa.g),
                    (eb[Oa + 2] = Wa.b),
                    (eb[Oa + 3] = ja.r),
                    (eb[Oa + 4] = ja.g),
                    (eb[Oa + 5] = ja.b),
                    (eb[Oa + 6] = qa.r),
                    (eb[Oa + 7] = qa.g),
                    (eb[Oa + 8] = qa.b),
                    (Oa += 9);
                D = 0;
                for (A = ta.length; D < A; D++)
                  (O = jb[ta[D]]),
                    (P = O.vertexColors),
                    (V = O.color),
                    4 === P.length && K === THREE.VertexColors
                      ? ((Wa = P[0]), (ja = P[1]), (qa = P[2]), (na = P[3]))
                      : (na = qa = ja = Wa = V),
                    (eb[Oa] = Wa.r),
                    (eb[Oa + 1] = Wa.g),
                    (eb[Oa + 2] = Wa.b),
                    (eb[Oa + 3] = ja.r),
                    (eb[Oa + 4] = ja.g),
                    (eb[Oa + 5] = ja.b),
                    (eb[Oa + 6] = qa.r),
                    (eb[Oa + 7] = qa.g),
                    (eb[Oa + 8] = qa.b),
                    (eb[Oa + 9] = na.r),
                    (eb[Oa + 10] = na.g),
                    (eb[Oa + 11] = na.b),
                    (Oa += 12);
                0 < Oa &&
                  (k.bindBuffer(k.ARRAY_BUFFER, C.__webglColorBuffer),
                  k.bufferData(k.ARRAY_BUFFER, eb, G));
              }
              if (Tb && ob.hasTangents) {
                D = 0;
                for (A = sa.length; D < A; D++)
                  (O = jb[sa[D]]),
                    (W = O.vertexTangents),
                    (ga = W[0]),
                    (pa = W[1]),
                    (ca = W[2]),
                    (Fa[Ba] = ga.x),
                    (Fa[Ba + 1] = ga.y),
                    (Fa[Ba + 2] = ga.z),
                    (Fa[Ba + 3] = ga.w),
                    (Fa[Ba + 4] = pa.x),
                    (Fa[Ba + 5] = pa.y),
                    (Fa[Ba + 6] = pa.z),
                    (Fa[Ba + 7] = pa.w),
                    (Fa[Ba + 8] = ca.x),
                    (Fa[Ba + 9] = ca.y),
                    (Fa[Ba + 10] = ca.z),
                    (Fa[Ba + 11] = ca.w),
                    (Ba += 12);
                D = 0;
                for (A = ta.length; D < A; D++)
                  (O = jb[ta[D]]),
                    (W = O.vertexTangents),
                    (ga = W[0]),
                    (pa = W[1]),
                    (ca = W[2]),
                    (ab = W[3]),
                    (Fa[Ba] = ga.x),
                    (Fa[Ba + 1] = ga.y),
                    (Fa[Ba + 2] = ga.z),
                    (Fa[Ba + 3] = ga.w),
                    (Fa[Ba + 4] = pa.x),
                    (Fa[Ba + 5] = pa.y),
                    (Fa[Ba + 6] = pa.z),
                    (Fa[Ba + 7] = pa.w),
                    (Fa[Ba + 8] = ca.x),
                    (Fa[Ba + 9] = ca.y),
                    (Fa[Ba + 10] = ca.z),
                    (Fa[Ba + 11] = ca.w),
                    (Fa[Ba + 12] = ab.x),
                    (Fa[Ba + 13] = ab.y),
                    (Fa[Ba + 14] = ab.z),
                    (Fa[Ba + 15] = ab.w),
                    (Ba += 16);
                k.bindBuffer(k.ARRAY_BUFFER, C.__webglTangentBuffer);
                k.bufferData(k.ARRAY_BUFFER, Fa, G);
              }
              if (Ob && L) {
                D = 0;
                for (A = sa.length; D < A; D++)
                  if (
                    ((O = jb[sa[D]]),
                    (U = O.vertexNormals),
                    (R = O.normal),
                    3 === U.length && M)
                  )
                    for (va = 0; 3 > va; va++)
                      (Ma = U[va]),
                        (xb[ib] = Ma.x),
                        (xb[ib + 1] = Ma.y),
                        (xb[ib + 2] = Ma.z),
                        (ib += 3);
                  else
                    for (va = 0; 3 > va; va++)
                      (xb[ib] = R.x),
                        (xb[ib + 1] = R.y),
                        (xb[ib + 2] = R.z),
                        (ib += 3);
                D = 0;
                for (A = ta.length; D < A; D++)
                  if (
                    ((O = jb[ta[D]]),
                    (U = O.vertexNormals),
                    (R = O.normal),
                    4 === U.length && M)
                  )
                    for (va = 0; 4 > va; va++)
                      (Ma = U[va]),
                        (xb[ib] = Ma.x),
                        (xb[ib + 1] = Ma.y),
                        (xb[ib + 2] = Ma.z),
                        (ib += 3);
                  else
                    for (va = 0; 4 > va; va++)
                      (xb[ib] = R.x),
                        (xb[ib + 1] = R.y),
                        (xb[ib + 2] = R.z),
                        (ib += 3);
                k.bindBuffer(k.ARRAY_BUFFER, C.__webglNormalBuffer);
                k.bufferData(k.ARRAY_BUFFER, xb, G);
              }
              if (Kb && Vb && N) {
                D = 0;
                for (A = sa.length; D < A; D++)
                  if (((fa = sa[D]), (Z = Vb[fa]), void 0 !== Z))
                    for (va = 0; 3 > va; va++)
                      (Ua = Z[va]),
                        (lb[Ta] = Ua.x),
                        (lb[Ta + 1] = Ua.y),
                        (Ta += 2);
                D = 0;
                for (A = ta.length; D < A; D++)
                  if (((fa = ta[D]), (Z = Vb[fa]), void 0 !== Z))
                    for (va = 0; 4 > va; va++)
                      (Ua = Z[va]),
                        (lb[Ta] = Ua.x),
                        (lb[Ta + 1] = Ua.y),
                        (Ta += 2);
                0 < Ta &&
                  (k.bindBuffer(k.ARRAY_BUFFER, C.__webglUVBuffer),
                  k.bufferData(k.ARRAY_BUFFER, lb, G));
              }
              if (Kb && Qc && N) {
                D = 0;
                for (A = sa.length; D < A; D++)
                  if (((fa = sa[D]), (da = Qc[fa]), void 0 !== da))
                    for (va = 0; 3 > va; va++)
                      (Xa = da[va]),
                        (sb[Va] = Xa.x),
                        (sb[Va + 1] = Xa.y),
                        (Va += 2);
                D = 0;
                for (A = ta.length; D < A; D++)
                  if (((fa = ta[D]), (da = Qc[fa]), void 0 !== da))
                    for (va = 0; 4 > va; va++)
                      (Xa = da[va]),
                        (sb[Va] = Xa.x),
                        (sb[Va + 1] = Xa.y),
                        (Va += 2);
                0 < Va &&
                  (k.bindBuffer(k.ARRAY_BUFFER, C.__webglUV2Buffer),
                  k.bufferData(k.ARRAY_BUFFER, sb, G));
              }
              if (Nb) {
                D = 0;
                for (A = sa.length; D < A; D++)
                  (Fb[wb] = La),
                    (Fb[wb + 1] = La + 1),
                    (Fb[wb + 2] = La + 2),
                    (wb += 3),
                    (ub[nb] = La),
                    (ub[nb + 1] = La + 1),
                    (ub[nb + 2] = La),
                    (ub[nb + 3] = La + 2),
                    (ub[nb + 4] = La + 1),
                    (ub[nb + 5] = La + 2),
                    (nb += 6),
                    (La += 3);
                D = 0;
                for (A = ta.length; D < A; D++)
                  (Fb[wb] = La),
                    (Fb[wb + 1] = La + 1),
                    (Fb[wb + 2] = La + 3),
                    (Fb[wb + 3] = La + 1),
                    (Fb[wb + 4] = La + 2),
                    (Fb[wb + 5] = La + 3),
                    (wb += 6),
                    (ub[nb] = La),
                    (ub[nb + 1] = La + 1),
                    (ub[nb + 2] = La),
                    (ub[nb + 3] = La + 3),
                    (ub[nb + 4] = La + 1),
                    (ub[nb + 5] = La + 2),
                    (ub[nb + 6] = La + 2),
                    (ub[nb + 7] = La + 3),
                    (nb += 8),
                    (La += 4);
                k.bindBuffer(k.ELEMENT_ARRAY_BUFFER, C.__webglFaceBuffer);
                k.bufferData(k.ELEMENT_ARRAY_BUFFER, Fb, G);
                k.bindBuffer(k.ELEMENT_ARRAY_BUFFER, C.__webglLineBuffer);
                k.bufferData(k.ELEMENT_ARRAY_BUFFER, ub, G);
              }
              if (Cb) {
                va = 0;
                for (bb = Cb.length; va < bb; va++)
                  if (((v = Cb[va]), v.__original.needsUpdate)) {
                    w = 0;
                    if (1 === v.size)
                      if (void 0 === v.boundTo || "vertices" === v.boundTo) {
                        D = 0;
                        for (A = sa.length; D < A; D++)
                          (O = jb[sa[D]]),
                            (v.array[w] = v.value[O.a]),
                            (v.array[w + 1] = v.value[O.b]),
                            (v.array[w + 2] = v.value[O.c]),
                            (w += 3);
                        D = 0;
                        for (A = ta.length; D < A; D++)
                          (O = jb[ta[D]]),
                            (v.array[w] = v.value[O.a]),
                            (v.array[w + 1] = v.value[O.b]),
                            (v.array[w + 2] = v.value[O.c]),
                            (v.array[w + 3] = v.value[O.d]),
                            (w += 4);
                      } else {
                        if ("faces" === v.boundTo) {
                          D = 0;
                          for (A = sa.length; D < A; D++)
                            (ya = v.value[sa[D]]),
                              (v.array[w] = ya),
                              (v.array[w + 1] = ya),
                              (v.array[w + 2] = ya),
                              (w += 3);
                          D = 0;
                          for (A = ta.length; D < A; D++)
                            (ya = v.value[ta[D]]),
                              (v.array[w] = ya),
                              (v.array[w + 1] = ya),
                              (v.array[w + 2] = ya),
                              (v.array[w + 3] = ya),
                              (w += 4);
                        }
                      }
                    else if (2 === v.size)
                      if (void 0 === v.boundTo || "vertices" === v.boundTo) {
                        D = 0;
                        for (A = sa.length; D < A; D++)
                          (O = jb[sa[D]]),
                            (S = v.value[O.a]),
                            (T = v.value[O.b]),
                            (Q = v.value[O.c]),
                            (v.array[w] = S.x),
                            (v.array[w + 1] = S.y),
                            (v.array[w + 2] = T.x),
                            (v.array[w + 3] = T.y),
                            (v.array[w + 4] = Q.x),
                            (v.array[w + 5] = Q.y),
                            (w += 6);
                        D = 0;
                        for (A = ta.length; D < A; D++)
                          (O = jb[ta[D]]),
                            (S = v.value[O.a]),
                            (T = v.value[O.b]),
                            (Q = v.value[O.c]),
                            (aa = v.value[O.d]),
                            (v.array[w] = S.x),
                            (v.array[w + 1] = S.y),
                            (v.array[w + 2] = T.x),
                            (v.array[w + 3] = T.y),
                            (v.array[w + 4] = Q.x),
                            (v.array[w + 5] = Q.y),
                            (v.array[w + 6] = aa.x),
                            (v.array[w + 7] = aa.y),
                            (w += 8);
                      } else {
                        if ("faces" === v.boundTo) {
                          D = 0;
                          for (A = sa.length; D < A; D++)
                            (Q = T = S = ya = v.value[sa[D]]),
                              (v.array[w] = S.x),
                              (v.array[w + 1] = S.y),
                              (v.array[w + 2] = T.x),
                              (v.array[w + 3] = T.y),
                              (v.array[w + 4] = Q.x),
                              (v.array[w + 5] = Q.y),
                              (w += 6);
                          D = 0;
                          for (A = ta.length; D < A; D++)
                            (aa = Q = T = S = ya = v.value[ta[D]]),
                              (v.array[w] = S.x),
                              (v.array[w + 1] = S.y),
                              (v.array[w + 2] = T.x),
                              (v.array[w + 3] = T.y),
                              (v.array[w + 4] = Q.x),
                              (v.array[w + 5] = Q.y),
                              (v.array[w + 6] = aa.x),
                              (v.array[w + 7] = aa.y),
                              (w += 8);
                        }
                      }
                    else if (3 === v.size) {
                      var X;
                      X = "c" === v.type ? ["r", "g", "b"] : ["x", "y", "z"];
                      if (void 0 === v.boundTo || "vertices" === v.boundTo) {
                        D = 0;
                        for (A = sa.length; D < A; D++)
                          (O = jb[sa[D]]),
                            (S = v.value[O.a]),
                            (T = v.value[O.b]),
                            (Q = v.value[O.c]),
                            (v.array[w] = S[X[0]]),
                            (v.array[w + 1] = S[X[1]]),
                            (v.array[w + 2] = S[X[2]]),
                            (v.array[w + 3] = T[X[0]]),
                            (v.array[w + 4] = T[X[1]]),
                            (v.array[w + 5] = T[X[2]]),
                            (v.array[w + 6] = Q[X[0]]),
                            (v.array[w + 7] = Q[X[1]]),
                            (v.array[w + 8] = Q[X[2]]),
                            (w += 9);
                        D = 0;
                        for (A = ta.length; D < A; D++)
                          (O = jb[ta[D]]),
                            (S = v.value[O.a]),
                            (T = v.value[O.b]),
                            (Q = v.value[O.c]),
                            (aa = v.value[O.d]),
                            (v.array[w] = S[X[0]]),
                            (v.array[w + 1] = S[X[1]]),
                            (v.array[w + 2] = S[X[2]]),
                            (v.array[w + 3] = T[X[0]]),
                            (v.array[w + 4] = T[X[1]]),
                            (v.array[w + 5] = T[X[2]]),
                            (v.array[w + 6] = Q[X[0]]),
                            (v.array[w + 7] = Q[X[1]]),
                            (v.array[w + 8] = Q[X[2]]),
                            (v.array[w + 9] = aa[X[0]]),
                            (v.array[w + 10] = aa[X[1]]),
                            (v.array[w + 11] = aa[X[2]]),
                            (w += 12);
                      } else if ("faces" === v.boundTo) {
                        D = 0;
                        for (A = sa.length; D < A; D++)
                          (Q = T = S = ya = v.value[sa[D]]),
                            (v.array[w] = S[X[0]]),
                            (v.array[w + 1] = S[X[1]]),
                            (v.array[w + 2] = S[X[2]]),
                            (v.array[w + 3] = T[X[0]]),
                            (v.array[w + 4] = T[X[1]]),
                            (v.array[w + 5] = T[X[2]]),
                            (v.array[w + 6] = Q[X[0]]),
                            (v.array[w + 7] = Q[X[1]]),
                            (v.array[w + 8] = Q[X[2]]),
                            (w += 9);
                        D = 0;
                        for (A = ta.length; D < A; D++)
                          (aa = Q = T = S = ya = v.value[ta[D]]),
                            (v.array[w] = S[X[0]]),
                            (v.array[w + 1] = S[X[1]]),
                            (v.array[w + 2] = S[X[2]]),
                            (v.array[w + 3] = T[X[0]]),
                            (v.array[w + 4] = T[X[1]]),
                            (v.array[w + 5] = T[X[2]]),
                            (v.array[w + 6] = Q[X[0]]),
                            (v.array[w + 7] = Q[X[1]]),
                            (v.array[w + 8] = Q[X[2]]),
                            (v.array[w + 9] = aa[X[0]]),
                            (v.array[w + 10] = aa[X[1]]),
                            (v.array[w + 11] = aa[X[2]]),
                            (w += 12);
                      } else if ("faceVertices" === v.boundTo) {
                        D = 0;
                        for (A = sa.length; D < A; D++)
                          (ya = v.value[sa[D]]),
                            (S = ya[0]),
                            (T = ya[1]),
                            (Q = ya[2]),
                            (v.array[w] = S[X[0]]),
                            (v.array[w + 1] = S[X[1]]),
                            (v.array[w + 2] = S[X[2]]),
                            (v.array[w + 3] = T[X[0]]),
                            (v.array[w + 4] = T[X[1]]),
                            (v.array[w + 5] = T[X[2]]),
                            (v.array[w + 6] = Q[X[0]]),
                            (v.array[w + 7] = Q[X[1]]),
                            (v.array[w + 8] = Q[X[2]]),
                            (w += 9);
                        D = 0;
                        for (A = ta.length; D < A; D++)
                          (ya = v.value[ta[D]]),
                            (S = ya[0]),
                            (T = ya[1]),
                            (Q = ya[2]),
                            (aa = ya[3]),
                            (v.array[w] = S[X[0]]),
                            (v.array[w + 1] = S[X[1]]),
                            (v.array[w + 2] = S[X[2]]),
                            (v.array[w + 3] = T[X[0]]),
                            (v.array[w + 4] = T[X[1]]),
                            (v.array[w + 5] = T[X[2]]),
                            (v.array[w + 6] = Q[X[0]]),
                            (v.array[w + 7] = Q[X[1]]),
                            (v.array[w + 8] = Q[X[2]]),
                            (v.array[w + 9] = aa[X[0]]),
                            (v.array[w + 10] = aa[X[1]]),
                            (v.array[w + 11] = aa[X[2]]),
                            (w += 12);
                      }
                    } else if (4 === v.size)
                      if (void 0 === v.boundTo || "vertices" === v.boundTo) {
                        D = 0;
                        for (A = sa.length; D < A; D++)
                          (O = jb[sa[D]]),
                            (S = v.value[O.a]),
                            (T = v.value[O.b]),
                            (Q = v.value[O.c]),
                            (v.array[w] = S.x),
                            (v.array[w + 1] = S.y),
                            (v.array[w + 2] = S.z),
                            (v.array[w + 3] = S.w),
                            (v.array[w + 4] = T.x),
                            (v.array[w + 5] = T.y),
                            (v.array[w + 6] = T.z),
                            (v.array[w + 7] = T.w),
                            (v.array[w + 8] = Q.x),
                            (v.array[w + 9] = Q.y),
                            (v.array[w + 10] = Q.z),
                            (v.array[w + 11] = Q.w),
                            (w += 12);
                        D = 0;
                        for (A = ta.length; D < A; D++)
                          (O = jb[ta[D]]),
                            (S = v.value[O.a]),
                            (T = v.value[O.b]),
                            (Q = v.value[O.c]),
                            (aa = v.value[O.d]),
                            (v.array[w] = S.x),
                            (v.array[w + 1] = S.y),
                            (v.array[w + 2] = S.z),
                            (v.array[w + 3] = S.w),
                            (v.array[w + 4] = T.x),
                            (v.array[w + 5] = T.y),
                            (v.array[w + 6] = T.z),
                            (v.array[w + 7] = T.w),
                            (v.array[w + 8] = Q.x),
                            (v.array[w + 9] = Q.y),
                            (v.array[w + 10] = Q.z),
                            (v.array[w + 11] = Q.w),
                            (v.array[w + 12] = aa.x),
                            (v.array[w + 13] = aa.y),
                            (v.array[w + 14] = aa.z),
                            (v.array[w + 15] = aa.w),
                            (w += 16);
                      } else if ("faces" === v.boundTo) {
                        D = 0;
                        for (A = sa.length; D < A; D++)
                          (Q = T = S = ya = v.value[sa[D]]),
                            (v.array[w] = S.x),
                            (v.array[w + 1] = S.y),
                            (v.array[w + 2] = S.z),
                            (v.array[w + 3] = S.w),
                            (v.array[w + 4] = T.x),
                            (v.array[w + 5] = T.y),
                            (v.array[w + 6] = T.z),
                            (v.array[w + 7] = T.w),
                            (v.array[w + 8] = Q.x),
                            (v.array[w + 9] = Q.y),
                            (v.array[w + 10] = Q.z),
                            (v.array[w + 11] = Q.w),
                            (w += 12);
                        D = 0;
                        for (A = ta.length; D < A; D++)
                          (aa = Q = T = S = ya = v.value[ta[D]]),
                            (v.array[w] = S.x),
                            (v.array[w + 1] = S.y),
                            (v.array[w + 2] = S.z),
                            (v.array[w + 3] = S.w),
                            (v.array[w + 4] = T.x),
                            (v.array[w + 5] = T.y),
                            (v.array[w + 6] = T.z),
                            (v.array[w + 7] = T.w),
                            (v.array[w + 8] = Q.x),
                            (v.array[w + 9] = Q.y),
                            (v.array[w + 10] = Q.z),
                            (v.array[w + 11] = Q.w),
                            (v.array[w + 12] = aa.x),
                            (v.array[w + 13] = aa.y),
                            (v.array[w + 14] = aa.z),
                            (v.array[w + 15] = aa.w),
                            (w += 16);
                      } else if ("faceVertices" === v.boundTo) {
                        D = 0;
                        for (A = sa.length; D < A; D++)
                          (ya = v.value[sa[D]]),
                            (S = ya[0]),
                            (T = ya[1]),
                            (Q = ya[2]),
                            (v.array[w] = S.x),
                            (v.array[w + 1] = S.y),
                            (v.array[w + 2] = S.z),
                            (v.array[w + 3] = S.w),
                            (v.array[w + 4] = T.x),
                            (v.array[w + 5] = T.y),
                            (v.array[w + 6] = T.z),
                            (v.array[w + 7] = T.w),
                            (v.array[w + 8] = Q.x),
                            (v.array[w + 9] = Q.y),
                            (v.array[w + 10] = Q.z),
                            (v.array[w + 11] = Q.w),
                            (w += 12);
                        D = 0;
                        for (A = ta.length; D < A; D++)
                          (ya = v.value[ta[D]]),
                            (S = ya[0]),
                            (T = ya[1]),
                            (Q = ya[2]),
                            (aa = ya[3]),
                            (v.array[w] = S.x),
                            (v.array[w + 1] = S.y),
                            (v.array[w + 2] = S.z),
                            (v.array[w + 3] = S.w),
                            (v.array[w + 4] = T.x),
                            (v.array[w + 5] = T.y),
                            (v.array[w + 6] = T.z),
                            (v.array[w + 7] = T.w),
                            (v.array[w + 8] = Q.x),
                            (v.array[w + 9] = Q.y),
                            (v.array[w + 10] = Q.z),
                            (v.array[w + 11] = Q.w),
                            (v.array[w + 12] = aa.x),
                            (v.array[w + 13] = aa.y),
                            (v.array[w + 14] = aa.z),
                            (v.array[w + 15] = aa.w),
                            (w += 16);
                      }
                    k.bindBuffer(k.ARRAY_BUFFER, v.buffer);
                    k.bufferData(k.ARRAY_BUFFER, v.array, G);
                  }
              }
              I &&
                (delete C.__inittedArrays,
                delete C.__colorArray,
                delete C.__normalArray,
                delete C.__tangentArray,
                delete C.__uvArray,
                delete C.__uv2Array,
                delete C.__faceArray,
                delete C.__vertexArray,
                delete C.__lineArray,
                delete C.__skinIndexArray,
                delete C.__skinWeightArray);
            }
          }
        j.verticesNeedUpdate = !1;
        j.morphTargetsNeedUpdate = !1;
        j.elementsNeedUpdate = !1;
        j.uvsNeedUpdate = !1;
        j.normalsNeedUpdate = !1;
        j.colorsNeedUpdate = !1;
        j.tangentsNeedUpdate = !1;
        j.buffersNeedUpdate = !1;
        n.attributes && y(n);
      } else if (i instanceof THREE.Ribbon) {
        n = e(i, j);
        p = n.attributes && q(n);
        if (
          j.verticesNeedUpdate ||
          j.colorsNeedUpdate ||
          j.normalsNeedUpdate ||
          p
        ) {
          var yb = j,
            sc = k.DYNAMIC_DRAW,
            hc = void 0,
            ic = void 0,
            jc = void 0,
            tc = void 0,
            za = void 0,
            uc = void 0,
            vc = void 0,
            wc = void 0,
            cc = void 0,
            gb = void 0,
            $b = void 0,
            Da = void 0,
            pb = void 0,
            dc = yb.vertices,
            fc = yb.colors,
            gc = yb.normals,
            oc = dc.length,
            pc = fc.length,
            Hc = gc.length,
            xc = yb.__vertexArray,
            yc = yb.__colorArray,
            zc = yb.__normalArray,
            Ic = yb.colorsNeedUpdate,
            Jc = yb.normalsNeedUpdate,
            Rc = yb.__webglCustomAttributesList;
          if (yb.verticesNeedUpdate) {
            for (hc = 0; hc < oc; hc++)
              (tc = dc[hc]),
                (za = 3 * hc),
                (xc[za] = tc.x),
                (xc[za + 1] = tc.y),
                (xc[za + 2] = tc.z);
            k.bindBuffer(k.ARRAY_BUFFER, yb.__webglVertexBuffer);
            k.bufferData(k.ARRAY_BUFFER, xc, sc);
          }
          if (Ic) {
            for (ic = 0; ic < pc; ic++)
              (uc = fc[ic]),
                (za = 3 * ic),
                (yc[za] = uc.r),
                (yc[za + 1] = uc.g),
                (yc[za + 2] = uc.b);
            k.bindBuffer(k.ARRAY_BUFFER, yb.__webglColorBuffer);
            k.bufferData(k.ARRAY_BUFFER, yc, sc);
          }
          if (Jc) {
            for (jc = 0; jc < Hc; jc++)
              (vc = gc[jc]),
                (za = 3 * jc),
                (zc[za] = vc.x),
                (zc[za + 1] = vc.y),
                (zc[za + 2] = vc.z);
            k.bindBuffer(k.ARRAY_BUFFER, yb.__webglNormalBuffer);
            k.bufferData(k.ARRAY_BUFFER, zc, sc);
          }
          if (Rc) {
            wc = 0;
            for (cc = Rc.length; wc < cc; wc++)
              if (
                ((Da = Rc[wc]),
                Da.needsUpdate &&
                  (void 0 === Da.boundTo || "vertices" === Da.boundTo))
              ) {
                za = 0;
                $b = Da.value.length;
                if (1 === Da.size)
                  for (gb = 0; gb < $b; gb++) Da.array[gb] = Da.value[gb];
                else if (2 === Da.size)
                  for (gb = 0; gb < $b; gb++)
                    (pb = Da.value[gb]),
                      (Da.array[za] = pb.x),
                      (Da.array[za + 1] = pb.y),
                      (za += 2);
                else if (3 === Da.size)
                  if ("c" === Da.type)
                    for (gb = 0; gb < $b; gb++)
                      (pb = Da.value[gb]),
                        (Da.array[za] = pb.r),
                        (Da.array[za + 1] = pb.g),
                        (Da.array[za + 2] = pb.b),
                        (za += 3);
                  else
                    for (gb = 0; gb < $b; gb++)
                      (pb = Da.value[gb]),
                        (Da.array[za] = pb.x),
                        (Da.array[za + 1] = pb.y),
                        (Da.array[za + 2] = pb.z),
                        (za += 3);
                else if (4 === Da.size)
                  for (gb = 0; gb < $b; gb++)
                    (pb = Da.value[gb]),
                      (Da.array[za] = pb.x),
                      (Da.array[za + 1] = pb.y),
                      (Da.array[za + 2] = pb.z),
                      (Da.array[za + 3] = pb.w),
                      (za += 4);
                k.bindBuffer(k.ARRAY_BUFFER, Da.buffer);
                k.bufferData(k.ARRAY_BUFFER, Da.array, sc);
              }
          }
        }
        j.verticesNeedUpdate = !1;
        j.colorsNeedUpdate = !1;
        j.normalsNeedUpdate = !1;
        n.attributes && y(n);
      } else if (i instanceof THREE.Line) {
        n = e(i, j);
        p = n.attributes && q(n);
        if (
          j.verticesNeedUpdate ||
          j.colorsNeedUpdate ||
          j.lineDistancesNeedUpdate ||
          p
        ) {
          var zb = j,
            Ac = k.DYNAMIC_DRAW,
            kc = void 0,
            lc = void 0,
            mc = void 0,
            Bc = void 0,
            Ia = void 0,
            Cc = void 0,
            Wc = zb.vertices,
            Xc = zb.colors,
            Yc = zb.lineDistances,
            Kc = Wc.length,
            Lc = Xc.length,
            Mc = Yc.length,
            Dc = zb.__vertexArray,
            Ec = zb.__colorArray,
            Zc = zb.__lineDistanceArray,
            Nc = zb.colorsNeedUpdate,
            dd = zb.lineDistancesNeedUpdate,
            Sc = zb.__webglCustomAttributesList,
            Fc = void 0,
            $c = void 0,
            hb = void 0,
            ac = void 0,
            qb = void 0,
            Ea = void 0;
          if (zb.verticesNeedUpdate) {
            for (kc = 0; kc < Kc; kc++)
              (Bc = Wc[kc]),
                (Ia = 3 * kc),
                (Dc[Ia] = Bc.x),
                (Dc[Ia + 1] = Bc.y),
                (Dc[Ia + 2] = Bc.z);
            k.bindBuffer(k.ARRAY_BUFFER, zb.__webglVertexBuffer);
            k.bufferData(k.ARRAY_BUFFER, Dc, Ac);
          }
          if (Nc) {
            for (lc = 0; lc < Lc; lc++)
              (Cc = Xc[lc]),
                (Ia = 3 * lc),
                (Ec[Ia] = Cc.r),
                (Ec[Ia + 1] = Cc.g),
                (Ec[Ia + 2] = Cc.b);
            k.bindBuffer(k.ARRAY_BUFFER, zb.__webglColorBuffer);
            k.bufferData(k.ARRAY_BUFFER, Ec, Ac);
          }
          if (dd) {
            for (mc = 0; mc < Mc; mc++) Zc[mc] = Yc[mc];
            k.bindBuffer(k.ARRAY_BUFFER, zb.__webglLineDistanceBuffer);
            k.bufferData(k.ARRAY_BUFFER, Zc, Ac);
          }
          if (Sc) {
            Fc = 0;
            for ($c = Sc.length; Fc < $c; Fc++)
              if (
                ((Ea = Sc[Fc]),
                Ea.needsUpdate &&
                  (void 0 === Ea.boundTo || "vertices" === Ea.boundTo))
              ) {
                Ia = 0;
                ac = Ea.value.length;
                if (1 === Ea.size)
                  for (hb = 0; hb < ac; hb++) Ea.array[hb] = Ea.value[hb];
                else if (2 === Ea.size)
                  for (hb = 0; hb < ac; hb++)
                    (qb = Ea.value[hb]),
                      (Ea.array[Ia] = qb.x),
                      (Ea.array[Ia + 1] = qb.y),
                      (Ia += 2);
                else if (3 === Ea.size)
                  if ("c" === Ea.type)
                    for (hb = 0; hb < ac; hb++)
                      (qb = Ea.value[hb]),
                        (Ea.array[Ia] = qb.r),
                        (Ea.array[Ia + 1] = qb.g),
                        (Ea.array[Ia + 2] = qb.b),
                        (Ia += 3);
                  else
                    for (hb = 0; hb < ac; hb++)
                      (qb = Ea.value[hb]),
                        (Ea.array[Ia] = qb.x),
                        (Ea.array[Ia + 1] = qb.y),
                        (Ea.array[Ia + 2] = qb.z),
                        (Ia += 3);
                else if (4 === Ea.size)
                  for (hb = 0; hb < ac; hb++)
                    (qb = Ea.value[hb]),
                      (Ea.array[Ia] = qb.x),
                      (Ea.array[Ia + 1] = qb.y),
                      (Ea.array[Ia + 2] = qb.z),
                      (Ea.array[Ia + 3] = qb.w),
                      (Ia += 4);
                k.bindBuffer(k.ARRAY_BUFFER, Ea.buffer);
                k.bufferData(k.ARRAY_BUFFER, Ea.array, Ac);
              }
          }
        }
        j.verticesNeedUpdate = !1;
        j.colorsNeedUpdate = !1;
        j.lineDistancesNeedUpdate = !1;
        n.attributes && y(n);
      } else if (i instanceof THREE.ParticleSystem) {
        n = e(i, j);
        p = n.attributes && q(n);
        if (
          j.verticesNeedUpdate ||
          j.colorsNeedUpdate ||
          i.sortParticles ||
          p
        ) {
          var Gb = j,
            Tc = k.DYNAMIC_DRAW,
            nc = i,
            rb = void 0,
            Hb = void 0,
            Ib = void 0,
            ba = void 0,
            Jb = void 0,
            Sb = void 0,
            Gc = Gb.vertices,
            Uc = Gc.length,
            Vc = Gb.colors,
            ad = Vc.length,
            Yb = Gb.__vertexArray,
            Zb = Gb.__colorArray,
            Lb = Gb.__sortArray,
            bd = Gb.verticesNeedUpdate,
            cd = Gb.colorsNeedUpdate,
            Mb = Gb.__webglCustomAttributesList,
            Db = void 0,
            bc = void 0,
            ma = void 0,
            Eb = void 0,
            Ca = void 0,
            $ = void 0;
          if (nc.sortParticles) {
            tb.copy(Ja);
            tb.multiply(nc.matrixWorld);
            for (rb = 0; rb < Uc; rb++)
              (Ib = Gc[rb]),
                Na.copy(Ib),
                Na.applyProjection(tb),
                (Lb[rb] = [Na.z, rb]);
            Lb.sort(m);
            for (rb = 0; rb < Uc; rb++)
              (Ib = Gc[Lb[rb][1]]),
                (ba = 3 * rb),
                (Yb[ba] = Ib.x),
                (Yb[ba + 1] = Ib.y),
                (Yb[ba + 2] = Ib.z);
            for (Hb = 0; Hb < ad; Hb++)
              (ba = 3 * Hb),
                (Sb = Vc[Lb[Hb][1]]),
                (Zb[ba] = Sb.r),
                (Zb[ba + 1] = Sb.g),
                (Zb[ba + 2] = Sb.b);
            if (Mb) {
              Db = 0;
              for (bc = Mb.length; Db < bc; Db++)
                if (
                  (($ = Mb[Db]),
                  void 0 === $.boundTo || "vertices" === $.boundTo)
                )
                  if (((ba = 0), (Eb = $.value.length), 1 === $.size))
                    for (ma = 0; ma < Eb; ma++)
                      (Jb = Lb[ma][1]), ($.array[ma] = $.value[Jb]);
                  else if (2 === $.size)
                    for (ma = 0; ma < Eb; ma++)
                      (Jb = Lb[ma][1]),
                        (Ca = $.value[Jb]),
                        ($.array[ba] = Ca.x),
                        ($.array[ba + 1] = Ca.y),
                        (ba += 2);
                  else if (3 === $.size)
                    if ("c" === $.type)
                      for (ma = 0; ma < Eb; ma++)
                        (Jb = Lb[ma][1]),
                          (Ca = $.value[Jb]),
                          ($.array[ba] = Ca.r),
                          ($.array[ba + 1] = Ca.g),
                          ($.array[ba + 2] = Ca.b),
                          (ba += 3);
                    else
                      for (ma = 0; ma < Eb; ma++)
                        (Jb = Lb[ma][1]),
                          (Ca = $.value[Jb]),
                          ($.array[ba] = Ca.x),
                          ($.array[ba + 1] = Ca.y),
                          ($.array[ba + 2] = Ca.z),
                          (ba += 3);
                  else if (4 === $.size)
                    for (ma = 0; ma < Eb; ma++)
                      (Jb = Lb[ma][1]),
                        (Ca = $.value[Jb]),
                        ($.array[ba] = Ca.x),
                        ($.array[ba + 1] = Ca.y),
                        ($.array[ba + 2] = Ca.z),
                        ($.array[ba + 3] = Ca.w),
                        (ba += 4);
            }
          } else {
            if (bd)
              for (rb = 0; rb < Uc; rb++)
                (Ib = Gc[rb]),
                  (ba = 3 * rb),
                  (Yb[ba] = Ib.x),
                  (Yb[ba + 1] = Ib.y),
                  (Yb[ba + 2] = Ib.z);
            if (cd)
              for (Hb = 0; Hb < ad; Hb++)
                (Sb = Vc[Hb]),
                  (ba = 3 * Hb),
                  (Zb[ba] = Sb.r),
                  (Zb[ba + 1] = Sb.g),
                  (Zb[ba + 2] = Sb.b);
            if (Mb) {
              Db = 0;
              for (bc = Mb.length; Db < bc; Db++)
                if (
                  (($ = Mb[Db]),
                  $.needsUpdate &&
                    (void 0 === $.boundTo || "vertices" === $.boundTo))
                )
                  if (((Eb = $.value.length), (ba = 0), 1 === $.size))
                    for (ma = 0; ma < Eb; ma++) $.array[ma] = $.value[ma];
                  else if (2 === $.size)
                    for (ma = 0; ma < Eb; ma++)
                      (Ca = $.value[ma]),
                        ($.array[ba] = Ca.x),
                        ($.array[ba + 1] = Ca.y),
                        (ba += 2);
                  else if (3 === $.size)
                    if ("c" === $.type)
                      for (ma = 0; ma < Eb; ma++)
                        (Ca = $.value[ma]),
                          ($.array[ba] = Ca.r),
                          ($.array[ba + 1] = Ca.g),
                          ($.array[ba + 2] = Ca.b),
                          (ba += 3);
                    else
                      for (ma = 0; ma < Eb; ma++)
                        (Ca = $.value[ma]),
                          ($.array[ba] = Ca.x),
                          ($.array[ba + 1] = Ca.y),
                          ($.array[ba + 2] = Ca.z),
                          (ba += 3);
                  else if (4 === $.size)
                    for (ma = 0; ma < Eb; ma++)
                      (Ca = $.value[ma]),
                        ($.array[ba] = Ca.x),
                        ($.array[ba + 1] = Ca.y),
                        ($.array[ba + 2] = Ca.z),
                        ($.array[ba + 3] = Ca.w),
                        (ba += 4);
            }
          }
          if (bd || nc.sortParticles)
            k.bindBuffer(k.ARRAY_BUFFER, Gb.__webglVertexBuffer),
              k.bufferData(k.ARRAY_BUFFER, Yb, Tc);
          if (cd || nc.sortParticles)
            k.bindBuffer(k.ARRAY_BUFFER, Gb.__webglColorBuffer),
              k.bufferData(k.ARRAY_BUFFER, Zb, Tc);
          if (Mb) {
            Db = 0;
            for (bc = Mb.length; Db < bc; Db++)
              if ((($ = Mb[Db]), $.needsUpdate || nc.sortParticles))
                k.bindBuffer(k.ARRAY_BUFFER, $.buffer),
                  k.bufferData(k.ARRAY_BUFFER, $.array, Tc);
          }
        }
        j.verticesNeedUpdate = !1;
        j.colorsNeedUpdate = !1;
        n.attributes && y(n);
      }
    }
  };
  this.initMaterial = function (a, b, c, d) {
    var e, f, g, h;
    a.addEventListener("dispose", P);
    var i, j, l, p, m;
    a instanceof THREE.MeshDepthMaterial
      ? (m = "depth")
      : a instanceof THREE.MeshNormalMaterial
      ? (m = "normal")
      : a instanceof THREE.MeshBasicMaterial
      ? (m = "basic")
      : a instanceof THREE.MeshLambertMaterial
      ? (m = "lambert")
      : a instanceof THREE.MeshPhongMaterial
      ? (m = "phong")
      : a instanceof THREE.LineBasicMaterial
      ? (m = "basic")
      : a instanceof THREE.LineDashedMaterial
      ? (m = "dashed")
      : a instanceof THREE.ParticleBasicMaterial && (m = "particle_basic");
    if (m) {
      var n = THREE.ShaderLib[m];
      a.uniforms = THREE.UniformsUtils.clone(n.uniforms);
      a.vertexShader = n.vertexShader;
      a.fragmentShader = n.fragmentShader;
    }
    var q, r, s;
    e = g = r = s = n = 0;
    for (f = b.length; e < f; e++)
      (q = b[e]),
        q.onlyShadow ||
          (q instanceof THREE.DirectionalLight && g++,
          q instanceof THREE.PointLight && r++,
          q instanceof THREE.SpotLight && s++,
          q instanceof THREE.HemisphereLight && n++);
    e = g;
    f = r;
    g = s;
    h = n;
    n = q = 0;
    for (s = b.length; n < s; n++)
      (r = b[n]),
        r.castShadow &&
          (r instanceof THREE.SpotLight && q++,
          r instanceof THREE.DirectionalLight && !r.shadowCascade && q++);
    p = q;
    Vb && d && d.useVertexTexture
      ? (l = 1024)
      : ((b = k.getParameter(k.MAX_VERTEX_UNIFORM_VECTORS)),
        (b = Math.floor((b - 20) / 4)),
        void 0 !== d &&
          d instanceof THREE.SkinnedMesh &&
          ((b = Math.min(d.bones.length, b)),
          b < d.bones.length &&
            console.warn(
              "WebGLRenderer: too many bones - " +
                d.bones.length +
                ", this GPU supports just " +
                b +
                " (try OpenGL instead of ANGLE)"
            )),
        (l = b));
    a: {
      s = a.fragmentShader;
      r = a.vertexShader;
      n = a.uniforms;
      b = a.attributes;
      q = a.defines;
      var c = {
          map: !!a.map,
          envMap: !!a.envMap,
          lightMap: !!a.lightMap,
          bumpMap: !!a.bumpMap,
          normalMap: !!a.normalMap,
          specularMap: !!a.specularMap,
          vertexColors: a.vertexColors,
          fog: c,
          useFog: a.fog,
          fogExp: c instanceof THREE.FogExp2,
          sizeAttenuation: a.sizeAttenuation,
          skinning: a.skinning,
          maxBones: l,
          useVertexTexture: Vb && d && d.useVertexTexture,
          boneTextureWidth: d && d.boneTextureWidth,
          boneTextureHeight: d && d.boneTextureHeight,
          morphTargets: a.morphTargets,
          morphNormals: a.morphNormals,
          maxMorphTargets: this.maxMorphTargets,
          maxMorphNormals: this.maxMorphNormals,
          maxDirLights: e,
          maxPointLights: f,
          maxSpotLights: g,
          maxHemiLights: h,
          maxShadows: p,
          shadowMapEnabled: this.shadowMapEnabled && d.receiveShadow,
          shadowMapType: this.shadowMapType,
          shadowMapDebug: this.shadowMapDebug,
          shadowMapCascade: this.shadowMapCascade,
          alphaTest: a.alphaTest,
          metal: a.metal,
          perPixel: a.perPixel,
          wrapAround: a.wrapAround,
          doubleSided: a.side === THREE.DoubleSide,
          flipSided: a.side === THREE.BackSide,
        },
        t,
        x,
        u,
        d = [];
      m ? d.push(m) : (d.push(s), d.push(r));
      for (x in q) d.push(x), d.push(q[x]);
      for (t in c) d.push(t), d.push(c[t]);
      m = d.join();
      t = 0;
      for (x = fa.length; t < x; t++)
        if (((d = fa[t]), d.code === m)) {
          d.usedTimes++;
          j = d.program;
          break a;
        }
      t = "SHADOWMAP_TYPE_BASIC";
      c.shadowMapType === THREE.PCFShadowMap
        ? (t = "SHADOWMAP_TYPE_PCF")
        : c.shadowMapType === THREE.PCFSoftShadowMap &&
          (t = "SHADOWMAP_TYPE_PCF_SOFT");
      x = [];
      for (u in q)
        (d = q[u]), !1 !== d && ((d = "#define " + u + " " + d), x.push(d));
      d = x.join("\n");
      u = k.createProgram();
      x = [
        "precision " + R + " float;",
        d,
        ec ? "#define VERTEX_TEXTURES" : "",
        N.gammaInput ? "#define GAMMA_INPUT" : "",
        N.gammaOutput ? "#define GAMMA_OUTPUT" : "",
        N.physicallyBasedShading ? "#define PHYSICALLY_BASED_SHADING" : "",
        "#define MAX_DIR_LIGHTS " + c.maxDirLights,
        "#define MAX_POINT_LIGHTS " + c.maxPointLights,
        "#define MAX_SPOT_LIGHTS " + c.maxSpotLights,
        "#define MAX_HEMI_LIGHTS " + c.maxHemiLights,
        "#define MAX_SHADOWS " + c.maxShadows,
        "#define MAX_BONES " + c.maxBones,
        c.map ? "#define USE_MAP" : "",
        c.envMap ? "#define USE_ENVMAP" : "",
        c.lightMap ? "#define USE_LIGHTMAP" : "",
        c.bumpMap ? "#define USE_BUMPMAP" : "",
        c.normalMap ? "#define USE_NORMALMAP" : "",
        c.specularMap ? "#define USE_SPECULARMAP" : "",
        c.vertexColors ? "#define USE_COLOR" : "",
        c.skinning ? "#define USE_SKINNING" : "",
        c.useVertexTexture ? "#define BONE_TEXTURE" : "",
        c.boneTextureWidth
          ? "#define N_BONE_PIXEL_X " + c.boneTextureWidth.toFixed(1)
          : "",
        c.boneTextureHeight
          ? "#define N_BONE_PIXEL_Y " + c.boneTextureHeight.toFixed(1)
          : "",
        c.morphTargets ? "#define USE_MORPHTARGETS" : "",
        c.morphNormals ? "#define USE_MORPHNORMALS" : "",
        c.perPixel ? "#define PHONG_PER_PIXEL" : "",
        c.wrapAround ? "#define WRAP_AROUND" : "",
        c.doubleSided ? "#define DOUBLE_SIDED" : "",
        c.flipSided ? "#define FLIP_SIDED" : "",
        c.shadowMapEnabled ? "#define USE_SHADOWMAP" : "",
        c.shadowMapEnabled ? "#define " + t : "",
        c.shadowMapDebug ? "#define SHADOWMAP_DEBUG" : "",
        c.shadowMapCascade ? "#define SHADOWMAP_CASCADE" : "",
        c.sizeAttenuation ? "#define USE_SIZEATTENUATION" : "",
        "uniform mat4 modelMatrix;\nuniform mat4 modelViewMatrix;\nuniform mat4 projectionMatrix;\nuniform mat4 viewMatrix;\nuniform mat3 normalMatrix;\nuniform vec3 cameraPosition;\nattribute vec3 position;\nattribute vec3 normal;\nattribute vec2 uv;\nattribute vec2 uv2;\n#ifdef USE_COLOR\nattribute vec3 color;\n#endif\n#ifdef USE_MORPHTARGETS\nattribute vec3 morphTarget0;\nattribute vec3 morphTarget1;\nattribute vec3 morphTarget2;\nattribute vec3 morphTarget3;\n#ifdef USE_MORPHNORMALS\nattribute vec3 morphNormal0;\nattribute vec3 morphNormal1;\nattribute vec3 morphNormal2;\nattribute vec3 morphNormal3;\n#else\nattribute vec3 morphTarget4;\nattribute vec3 morphTarget5;\nattribute vec3 morphTarget6;\nattribute vec3 morphTarget7;\n#endif\n#endif\n#ifdef USE_SKINNING\nattribute vec4 skinIndex;\nattribute vec4 skinWeight;\n#endif\n",
      ].join("\n");
      t = [
        "precision " + R + " float;",
        c.bumpMap || c.normalMap
          ? "#extension GL_OES_standard_derivatives : enable"
          : "",
        d,
        "#define MAX_DIR_LIGHTS " + c.maxDirLights,
        "#define MAX_POINT_LIGHTS " + c.maxPointLights,
        "#define MAX_SPOT_LIGHTS " + c.maxSpotLights,
        "#define MAX_HEMI_LIGHTS " + c.maxHemiLights,
        "#define MAX_SHADOWS " + c.maxShadows,
        c.alphaTest ? "#define ALPHATEST " + c.alphaTest : "",
        N.gammaInput ? "#define GAMMA_INPUT" : "",
        N.gammaOutput ? "#define GAMMA_OUTPUT" : "",
        N.physicallyBasedShading ? "#define PHYSICALLY_BASED_SHADING" : "",
        c.useFog && c.fog ? "#define USE_FOG" : "",
        c.useFog && c.fogExp ? "#define FOG_EXP2" : "",
        c.map ? "#define USE_MAP" : "",
        c.envMap ? "#define USE_ENVMAP" : "",
        c.lightMap ? "#define USE_LIGHTMAP" : "",
        c.bumpMap ? "#define USE_BUMPMAP" : "",
        c.normalMap ? "#define USE_NORMALMAP" : "",
        c.specularMap ? "#define USE_SPECULARMAP" : "",
        c.vertexColors ? "#define USE_COLOR" : "",
        c.metal ? "#define METAL" : "",
        c.perPixel ? "#define PHONG_PER_PIXEL" : "",
        c.wrapAround ? "#define WRAP_AROUND" : "",
        c.doubleSided ? "#define DOUBLE_SIDED" : "",
        c.flipSided ? "#define FLIP_SIDED" : "",
        c.shadowMapEnabled ? "#define USE_SHADOWMAP" : "",
        c.shadowMapEnabled ? "#define " + t : "",
        c.shadowMapDebug ? "#define SHADOWMAP_DEBUG" : "",
        c.shadowMapCascade ? "#define SHADOWMAP_CASCADE" : "",
        "uniform mat4 viewMatrix;\nuniform vec3 cameraPosition;\n",
      ].join("\n");
      x = L("vertex", x + r);
      t = L("fragment", t + s);
      k.attachShader(u, x);
      k.attachShader(u, t);
      k.linkProgram(u);
      k.getProgramParameter(u, k.LINK_STATUS) ||
        console.error(
          "Could not initialise shader\nVALIDATE_STATUS: " +
            k.getProgramParameter(u, k.VALIDATE_STATUS) +
            ", gl error [" +
            k.getError() +
            "]"
        );
      k.deleteShader(t);
      k.deleteShader(x);
      u.uniforms = {};
      u.attributes = {};
      var y;
      t =
        "viewMatrix modelViewMatrix projectionMatrix normalMatrix modelMatrix cameraPosition morphTargetInfluences".split(
          " "
        );
      c.useVertexTexture ? t.push("boneTexture") : t.push("boneGlobalMatrices");
      for (y in n) t.push(y);
      y = t;
      t = 0;
      for (x = y.length; t < x; t++)
        (n = y[t]), (u.uniforms[n] = k.getUniformLocation(u, n));
      t =
        "position normal uv uv2 tangent color skinIndex skinWeight lineDistance".split(
          " "
        );
      for (y = 0; y < c.maxMorphTargets; y++) t.push("morphTarget" + y);
      for (y = 0; y < c.maxMorphNormals; y++) t.push("morphNormal" + y);
      for (j in b) t.push(j);
      j = t;
      y = 0;
      for (b = j.length; y < b; y++)
        (t = j[y]), (u.attributes[t] = k.getAttribLocation(u, t));
      u.id = Wa++;
      fa.push({ program: u, code: m, usedTimes: 1 });
      N.info.memory.programs = fa.length;
      j = u;
    }
    a.program = j;
    y = a.program.attributes;
    if (a.morphTargets) {
      a.numSupportedMorphTargets = 0;
      b = "morphTarget";
      for (j = 0; j < this.maxMorphTargets; j++)
        (u = b + j), 0 <= y[u] && a.numSupportedMorphTargets++;
    }
    if (a.morphNormals) {
      a.numSupportedMorphNormals = 0;
      b = "morphNormal";
      for (j = 0; j < this.maxMorphNormals; j++)
        (u = b + j), 0 <= y[u] && a.numSupportedMorphNormals++;
    }
    a.uniformsList = [];
    for (i in a.uniforms) a.uniformsList.push([a.uniforms[i], i]);
  };
  this.setFaceCulling = function (a, b) {
    a === THREE.CullFaceNone
      ? k.disable(k.CULL_FACE)
      : (b === THREE.FrontFaceDirectionCW
          ? k.frontFace(k.CW)
          : k.frontFace(k.CCW),
        a === THREE.CullFaceBack
          ? k.cullFace(k.BACK)
          : a === THREE.CullFaceFront
          ? k.cullFace(k.FRONT)
          : k.cullFace(k.FRONT_AND_BACK),
        k.enable(k.CULL_FACE));
  };
  this.setMaterialFaces = function (a) {
    var b = a.side === THREE.DoubleSide,
      a = a.side === THREE.BackSide;
    W !== b && (b ? k.disable(k.CULL_FACE) : k.enable(k.CULL_FACE), (W = b));
    da !== a && (a ? k.frontFace(k.CW) : k.frontFace(k.CCW), (da = a));
  };
  this.setDepthTest = function (a) {
    kb !== a &&
      (a ? k.enable(k.DEPTH_TEST) : k.disable(k.DEPTH_TEST), (kb = a));
  };
  this.setDepthWrite = function (a) {
    oa !== a && (k.depthMask(a), (oa = a));
  };
  this.setBlending = function (a, b, c, d) {
    a !== la &&
      (a === THREE.NoBlending
        ? k.disable(k.BLEND)
        : a === THREE.AdditiveBlending
        ? (k.enable(k.BLEND),
          k.blendEquation(k.FUNC_ADD),
          k.blendFunc(k.SRC_ALPHA, k.ONE))
        : a === THREE.SubtractiveBlending
        ? (k.enable(k.BLEND),
          k.blendEquation(k.FUNC_ADD),
          k.blendFunc(k.ZERO, k.ONE_MINUS_SRC_COLOR))
        : a === THREE.MultiplyBlending
        ? (k.enable(k.BLEND),
          k.blendEquation(k.FUNC_ADD),
          k.blendFunc(k.ZERO, k.SRC_COLOR))
        : a === THREE.CustomBlending
        ? k.enable(k.BLEND)
        : (k.enable(k.BLEND),
          k.blendEquationSeparate(k.FUNC_ADD, k.FUNC_ADD),
          k.blendFuncSeparate(
            k.SRC_ALPHA,
            k.ONE_MINUS_SRC_ALPHA,
            k.ONE,
            k.ONE_MINUS_SRC_ALPHA
          )),
      (la = a));
    if (a === THREE.CustomBlending) {
      if ((b !== ha && (k.blendEquation(I(b)), (ha = b)), c !== ia || d !== Qa))
        k.blendFunc(I(c), I(d)), (ia = c), (Qa = d);
    } else Qa = ia = ha = null;
  };
  this.setTexture = function (a, b) {
    if (a.needsUpdate) {
      a.__webglInit ||
        ((a.__webglInit = !0),
        a.addEventListener("dispose", oc),
        (a.__webglTexture = k.createTexture()),
        N.info.memory.textures++);
      k.activeTexture(k.TEXTURE0 + b);
      k.bindTexture(k.TEXTURE_2D, a.__webglTexture);
      k.pixelStorei(k.UNPACK_FLIP_Y_WEBGL, a.flipY);
      k.pixelStorei(k.UNPACK_PREMULTIPLY_ALPHA_WEBGL, a.premultiplyAlpha);
      k.pixelStorei(k.UNPACK_ALIGNMENT, a.unpackAlignment);
      var c = a.image,
        d =
          0 === (c.width & (c.width - 1)) && 0 === (c.height & (c.height - 1)),
        e = I(a.format),
        f = I(a.type);
      B(k.TEXTURE_2D, a, d);
      var g = a.mipmaps;
      if (a instanceof THREE.DataTexture)
        if (0 < g.length && d) {
          for (var h = 0, i = g.length; h < i; h++)
            (c = g[h]),
              k.texImage2D(
                k.TEXTURE_2D,
                h,
                e,
                c.width,
                c.height,
                0,
                e,
                f,
                c.data
              );
          a.generateMipmaps = !1;
        } else
          k.texImage2D(k.TEXTURE_2D, 0, e, c.width, c.height, 0, e, f, c.data);
      else if (a instanceof THREE.CompressedTexture) {
        h = 0;
        for (i = g.length; h < i; h++)
          (c = g[h]),
            k.compressedTexImage2D(
              k.TEXTURE_2D,
              h,
              e,
              c.width,
              c.height,
              0,
              c.data
            );
      } else if (0 < g.length && d) {
        h = 0;
        for (i = g.length; h < i; h++)
          (c = g[h]), k.texImage2D(k.TEXTURE_2D, h, e, e, f, c);
        a.generateMipmaps = !1;
      } else k.texImage2D(k.TEXTURE_2D, 0, e, e, f, a.image);
      a.generateMipmaps && d && k.generateMipmap(k.TEXTURE_2D);
      a.needsUpdate = !1;
      if (a.onUpdate) a.onUpdate();
    } else
      k.activeTexture(k.TEXTURE0 + b),
        k.bindTexture(k.TEXTURE_2D, a.__webglTexture);
  };
  this.setRenderTarget = function (a) {
    var b = a instanceof THREE.WebGLRenderTargetCube;
    if (a && !a.__webglFramebuffer) {
      void 0 === a.depthBuffer && (a.depthBuffer = !0);
      void 0 === a.stencilBuffer && (a.stencilBuffer = !0);
      a.addEventListener("dispose", U);
      a.__webglTexture = k.createTexture();
      N.info.memory.textures++;
      var c =
          0 === (a.width & (a.width - 1)) && 0 === (a.height & (a.height - 1)),
        d = I(a.format),
        e = I(a.type);
      if (b) {
        a.__webglFramebuffer = [];
        a.__webglRenderbuffer = [];
        k.bindTexture(k.TEXTURE_CUBE_MAP, a.__webglTexture);
        B(k.TEXTURE_CUBE_MAP, a, c);
        for (var f = 0; 6 > f; f++) {
          a.__webglFramebuffer[f] = k.createFramebuffer();
          a.__webglRenderbuffer[f] = k.createRenderbuffer();
          k.texImage2D(
            k.TEXTURE_CUBE_MAP_POSITIVE_X + f,
            0,
            d,
            a.width,
            a.height,
            0,
            d,
            e,
            null
          );
          var g = a,
            h = k.TEXTURE_CUBE_MAP_POSITIVE_X + f;
          k.bindFramebuffer(k.FRAMEBUFFER, a.__webglFramebuffer[f]);
          k.framebufferTexture2D(
            k.FRAMEBUFFER,
            k.COLOR_ATTACHMENT0,
            h,
            g.__webglTexture,
            0
          );
          V(a.__webglRenderbuffer[f], a);
        }
        c && k.generateMipmap(k.TEXTURE_CUBE_MAP);
      } else
        (a.__webglFramebuffer = k.createFramebuffer()),
          (a.__webglRenderbuffer = a.shareDepthFrom
            ? a.shareDepthFrom.__webglRenderbuffer
            : k.createRenderbuffer()),
          k.bindTexture(k.TEXTURE_2D, a.__webglTexture),
          B(k.TEXTURE_2D, a, c),
          k.texImage2D(k.TEXTURE_2D, 0, d, a.width, a.height, 0, d, e, null),
          (d = k.TEXTURE_2D),
          k.bindFramebuffer(k.FRAMEBUFFER, a.__webglFramebuffer),
          k.framebufferTexture2D(
            k.FRAMEBUFFER,
            k.COLOR_ATTACHMENT0,
            d,
            a.__webglTexture,
            0
          ),
          a.shareDepthFrom
            ? a.depthBuffer && !a.stencilBuffer
              ? k.framebufferRenderbuffer(
                  k.FRAMEBUFFER,
                  k.DEPTH_ATTACHMENT,
                  k.RENDERBUFFER,
                  a.__webglRenderbuffer
                )
              : a.depthBuffer &&
                a.stencilBuffer &&
                k.framebufferRenderbuffer(
                  k.FRAMEBUFFER,
                  k.DEPTH_STENCIL_ATTACHMENT,
                  k.RENDERBUFFER,
                  a.__webglRenderbuffer
                )
            : V(a.__webglRenderbuffer, a),
          c && k.generateMipmap(k.TEXTURE_2D);
      b
        ? k.bindTexture(k.TEXTURE_CUBE_MAP, null)
        : k.bindTexture(k.TEXTURE_2D, null);
      k.bindRenderbuffer(k.RENDERBUFFER, null);
      k.bindFramebuffer(k.FRAMEBUFFER, null);
    }
    a
      ? ((b = b
          ? a.__webglFramebuffer[a.activeCubeFace]
          : a.__webglFramebuffer),
        (c = a.width),
        (a = a.height),
        (e = d = 0))
      : ((b = null), (c = Kb), (a = Ob), (d = sb), (e = Nb));
    b !== fb &&
      (k.bindFramebuffer(k.FRAMEBUFFER, b), k.viewport(d, e, c, a), (fb = b));
    Tb = c;
    Ub = a;
  };
  this.shadowMapPlugin = new THREE.ShadowMapPlugin();
  this.addPrePlugin(this.shadowMapPlugin);
  this.addPostPlugin(new THREE.SpritePlugin());
  this.addPostPlugin(new THREE.LensFlarePlugin());
};
THREE.WebGLRenderTarget = function (a, b, c) {
  this.width = a;
  this.height = b;
  c = c || {};
  this.wrapS = void 0 !== c.wrapS ? c.wrapS : THREE.ClampToEdgeWrapping;
  this.wrapT = void 0 !== c.wrapT ? c.wrapT : THREE.ClampToEdgeWrapping;
  this.magFilter = void 0 !== c.magFilter ? c.magFilter : THREE.LinearFilter;
  this.minFilter =
    void 0 !== c.minFilter ? c.minFilter : THREE.LinearMipMapLinearFilter;
  this.anisotropy = void 0 !== c.anisotropy ? c.anisotropy : 1;
  this.offset = new THREE.Vector2(0, 0);
  this.repeat = new THREE.Vector2(1, 1);
  this.format = void 0 !== c.format ? c.format : THREE.RGBAFormat;
  this.type = void 0 !== c.type ? c.type : THREE.UnsignedByteType;
  this.depthBuffer = void 0 !== c.depthBuffer ? c.depthBuffer : !0;
  this.stencilBuffer = void 0 !== c.stencilBuffer ? c.stencilBuffer : !0;
  this.generateMipmaps = !0;
  this.shareDepthFrom = null;
};
THREE.WebGLRenderTarget.prototype = {
  constructor: THREE.WebGLRenderTarget,
  addEventListener: THREE.EventDispatcher.prototype.addEventListener,
  hasEventListener: THREE.EventDispatcher.prototype.hasEventListener,
  removeEventListener: THREE.EventDispatcher.prototype.removeEventListener,
  dispatchEvent: THREE.EventDispatcher.prototype.dispatchEvent,
  clone: function () {
    var a = new THREE.WebGLRenderTarget(this.width, this.height);
    a.wrapS = this.wrapS;
    a.wrapT = this.wrapT;
    a.magFilter = this.magFilter;
    a.minFilter = this.minFilter;
    a.anisotropy = this.anisotropy;
    a.offset.copy(this.offset);
    a.repeat.copy(this.repeat);
    a.format = this.format;
    a.type = this.type;
    a.depthBuffer = this.depthBuffer;
    a.stencilBuffer = this.stencilBuffer;
    a.generateMipmaps = this.generateMipmaps;
    a.shareDepthFrom = this.shareDepthFrom;
    return a;
  },
  dispose: function () {
    this.dispatchEvent({ type: "dispose" });
  },
};
THREE.WebGLRenderTargetCube = function (a, b, c) {
  THREE.WebGLRenderTarget.call(this, a, b, c);
  this.activeCubeFace = 0;
};
THREE.WebGLRenderTargetCube.prototype = Object.create(
  THREE.WebGLRenderTarget.prototype
);
THREE.RenderableVertex = function () {
  this.positionWorld = new THREE.Vector3();
  this.positionScreen = new THREE.Vector4();
  this.visible = !0;
};
THREE.RenderableVertex.prototype.copy = function (a) {
  this.positionWorld.copy(a.positionWorld);
  this.positionScreen.copy(a.positionScreen);
};
THREE.RenderableFace3 = function () {
  this.v1 = new THREE.RenderableVertex();
  this.v2 = new THREE.RenderableVertex();
  this.v3 = new THREE.RenderableVertex();
  this.centroidModel = new THREE.Vector3();
  this.normalModel = new THREE.Vector3();
  this.normalModelView = new THREE.Vector3();
  this.vertexNormalsLength = 0;
  this.vertexNormalsModel = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  this.vertexNormalsModelView = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  this.material = this.color = null;
  this.uvs = [[]];
  this.z = null;
};
THREE.RenderableFace4 = function () {
  this.v1 = new THREE.RenderableVertex();
  this.v2 = new THREE.RenderableVertex();
  this.v3 = new THREE.RenderableVertex();
  this.v4 = new THREE.RenderableVertex();
  this.centroidModel = new THREE.Vector3();
  this.normalModel = new THREE.Vector3();
  this.normalModelView = new THREE.Vector3();
  this.vertexNormalsLength = 0;
  this.vertexNormalsModel = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  this.vertexNormalsModelView = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  this.material = this.color = null;
  this.uvs = [[]];
  this.z = null;
};
THREE.RenderableObject = function () {
  this.z = this.object = null;
};
THREE.RenderableParticle = function () {
  this.rotation = this.z = this.y = this.x = this.object = null;
  this.scale = new THREE.Vector2();
  this.material = null;
};
THREE.RenderableLine = function () {
  this.z = null;
  this.v1 = new THREE.RenderableVertex();
  this.v2 = new THREE.RenderableVertex();
  this.vertexColors = [new THREE.Color(), new THREE.Color()];
  this.material = null;
};
THREE.GeometryUtils = {
  merge: function (a, b, c) {
    var d,
      e,
      f = a.vertices.length,
      g = b instanceof THREE.Mesh ? b.geometry : b,
      h = a.vertices,
      i = g.vertices,
      j = a.faces,
      m = g.faces,
      a = a.faceVertexUvs[0],
      g = g.faceVertexUvs[0];
    void 0 === c && (c = 0);
    b instanceof THREE.Mesh &&
      (b.matrixAutoUpdate && b.updateMatrix(),
      (d = b.matrix),
      (e = new THREE.Matrix3().getNormalMatrix(d)));
    for (var b = 0, p = i.length; b < p; b++) {
      var l = i[b].clone();
      d && l.applyMatrix4(d);
      h.push(l);
    }
    b = 0;
    for (p = m.length; b < p; b++) {
      var l = m[b],
        r,
        s,
        n = l.vertexNormals,
        q = l.vertexColors;
      l instanceof THREE.Face3
        ? (r = new THREE.Face3(l.a + f, l.b + f, l.c + f))
        : l instanceof THREE.Face4 &&
          (r = new THREE.Face4(l.a + f, l.b + f, l.c + f, l.d + f));
      r.normal.copy(l.normal);
      e && r.normal.applyMatrix3(e).normalize();
      h = 0;
      for (i = n.length; h < i; h++)
        (s = n[h].clone()),
          e && s.applyMatrix3(e).normalize(),
          r.vertexNormals.push(s);
      r.color.copy(l.color);
      h = 0;
      for (i = q.length; h < i; h++) (s = q[h]), r.vertexColors.push(s.clone());
      r.materialIndex = l.materialIndex + c;
      r.centroid.copy(l.centroid);
      d && r.centroid.applyMatrix4(d);
      j.push(r);
    }
    b = 0;
    for (p = g.length; b < p; b++) {
      c = g[b];
      d = [];
      h = 0;
      for (i = c.length; h < i; h++) d.push(new THREE.Vector2(c[h].x, c[h].y));
      a.push(d);
    }
  },
  removeMaterials: function (a, b) {
    for (var c = {}, d = 0, e = b.length; d < e; d++) c[b[d]] = !0;
    for (var f, g = [], d = 0, e = a.faces.length; d < e; d++)
      (f = a.faces[d]), f.materialIndex in c || g.push(f);
    a.faces = g;
  },
  randomPointInTriangle: function (a, b, c) {
    var d,
      e,
      f,
      g = new THREE.Vector3(),
      h = THREE.GeometryUtils.__v1;
    d = THREE.GeometryUtils.random();
    e = THREE.GeometryUtils.random();
    1 < d + e && ((d = 1 - d), (e = 1 - e));
    f = 1 - d - e;
    g.copy(a);
    g.multiplyScalar(d);
    h.copy(b);
    h.multiplyScalar(e);
    g.add(h);
    h.copy(c);
    h.multiplyScalar(f);
    g.add(h);
    return g;
  },
  randomPointInFace: function (a, b, c) {
    var d, e, f;
    if (a instanceof THREE.Face3)
      return (
        (d = b.vertices[a.a]),
        (e = b.vertices[a.b]),
        (f = b.vertices[a.c]),
        THREE.GeometryUtils.randomPointInTriangle(d, e, f)
      );
    if (a instanceof THREE.Face4) {
      d = b.vertices[a.a];
      e = b.vertices[a.b];
      f = b.vertices[a.c];
      var b = b.vertices[a.d],
        g;
      c
        ? a._area1 && a._area2
          ? ((c = a._area1), (g = a._area2))
          : ((c = THREE.GeometryUtils.triangleArea(d, e, b)),
            (g = THREE.GeometryUtils.triangleArea(e, f, b)),
            (a._area1 = c),
            (a._area2 = g))
        : ((c = THREE.GeometryUtils.triangleArea(d, e, b)),
          (g = THREE.GeometryUtils.triangleArea(e, f, b)));
      return THREE.GeometryUtils.random() * (c + g) < c
        ? THREE.GeometryUtils.randomPointInTriangle(d, e, b)
        : THREE.GeometryUtils.randomPointInTriangle(e, f, b);
    }
  },
  randomPointsInGeometry: function (a, b) {
    function c(a) {
      function b(c, d) {
        if (d < c) return c;
        var e = c + Math.floor((d - c) / 2);
        return j[e] > a ? b(c, e - 1) : j[e] < a ? b(e + 1, d) : e;
      }
      return b(0, j.length - 1);
    }
    var d,
      e,
      f = a.faces,
      g = a.vertices,
      h = f.length,
      i = 0,
      j = [],
      m,
      p,
      l,
      r;
    for (e = 0; e < h; e++)
      (d = f[e]),
        d instanceof THREE.Face3
          ? ((m = g[d.a]),
            (p = g[d.b]),
            (l = g[d.c]),
            (d._area = THREE.GeometryUtils.triangleArea(m, p, l)))
          : d instanceof THREE.Face4 &&
            ((m = g[d.a]),
            (p = g[d.b]),
            (l = g[d.c]),
            (r = g[d.d]),
            (d._area1 = THREE.GeometryUtils.triangleArea(m, p, r)),
            (d._area2 = THREE.GeometryUtils.triangleArea(p, l, r)),
            (d._area = d._area1 + d._area2)),
        (i += d._area),
        (j[e] = i);
    d = [];
    for (e = 0; e < b; e++)
      (g = THREE.GeometryUtils.random() * i),
        (g = c(g)),
        (d[e] = THREE.GeometryUtils.randomPointInFace(f[g], a, !0));
    return d;
  },
  triangleArea: function (a, b, c) {
    var d = THREE.GeometryUtils.__v1,
      e = THREE.GeometryUtils.__v2;
    d.subVectors(b, a);
    e.subVectors(c, a);
    d.cross(e);
    return 0.5 * d.length();
  },
  center: function (a) {
    a.computeBoundingBox();
    var b = a.boundingBox,
      c = new THREE.Vector3();
    c.addVectors(b.min, b.max);
    c.multiplyScalar(-0.5);
    a.applyMatrix(new THREE.Matrix4().makeTranslation(c.x, c.y, c.z));
    a.computeBoundingBox();
    return c;
  },
  normalizeUVs: function (a) {
    for (var a = a.faceVertexUvs[0], b = 0, c = a.length; b < c; b++)
      for (var d = a[b], e = 0, f = d.length; e < f; e++)
        1 !== d[e].x && (d[e].x -= Math.floor(d[e].x)),
          1 !== d[e].y && (d[e].y -= Math.floor(d[e].y));
  },
  triangulateQuads: function (a) {
    var b,
      c,
      d,
      e,
      f = [],
      g = [],
      h = [];
    b = 0;
    for (c = a.faceUvs.length; b < c; b++) g[b] = [];
    b = 0;
    for (c = a.faceVertexUvs.length; b < c; b++) h[b] = [];
    b = 0;
    for (c = a.faces.length; b < c; b++)
      if (((d = a.faces[b]), d instanceof THREE.Face4)) {
        e = d.a;
        var i = d.b,
          j = d.c,
          m = d.d,
          p = new THREE.Face3(),
          l = new THREE.Face3();
        p.color.copy(d.color);
        l.color.copy(d.color);
        p.materialIndex = d.materialIndex;
        l.materialIndex = d.materialIndex;
        p.a = e;
        p.b = i;
        p.c = m;
        l.a = i;
        l.b = j;
        l.c = m;
        4 === d.vertexColors.length &&
          ((p.vertexColors[0] = d.vertexColors[0].clone()),
          (p.vertexColors[1] = d.vertexColors[1].clone()),
          (p.vertexColors[2] = d.vertexColors[3].clone()),
          (l.vertexColors[0] = d.vertexColors[1].clone()),
          (l.vertexColors[1] = d.vertexColors[2].clone()),
          (l.vertexColors[2] = d.vertexColors[3].clone()));
        f.push(p, l);
        d = 0;
        for (e = a.faceVertexUvs.length; d < e; d++)
          a.faceVertexUvs[d].length &&
            ((p = a.faceVertexUvs[d][b]),
            (i = p[1]),
            (j = p[2]),
            (m = p[3]),
            (p = [p[0].clone(), i.clone(), m.clone()]),
            (i = [i.clone(), j.clone(), m.clone()]),
            h[d].push(p, i));
        d = 0;
        for (e = a.faceUvs.length; d < e; d++)
          a.faceUvs[d].length && ((i = a.faceUvs[d][b]), g[d].push(i, i));
      } else {
        f.push(d);
        d = 0;
        for (e = a.faceUvs.length; d < e; d++) g[d].push(a.faceUvs[d][b]);
        d = 0;
        for (e = a.faceVertexUvs.length; d < e; d++)
          h[d].push(a.faceVertexUvs[d][b]);
      }
    a.faces = f;
    a.faceUvs = g;
    a.faceVertexUvs = h;
    a.computeCentroids();
    a.computeFaceNormals();
    a.computeVertexNormals();
    a.hasTangents && a.computeTangents();
  },
  setMaterialIndex: function (a, b, c, d) {
    a = a.faces;
    d = d || a.length - 1;
    for (c = c || 0; c <= d; c++) a[c].materialIndex = b;
  },
};
THREE.GeometryUtils.random = THREE.Math.random16;
THREE.GeometryUtils.__v1 = new THREE.Vector3();
THREE.GeometryUtils.__v2 = new THREE.Vector3();
THREE.ImageUtils = {
  crossOrigin: "anonymous",
  loadTexture: function (a, b, c, d) {
    var e = new Image(),
      f = new THREE.Texture(e, b),
      b = new THREE.ImageLoader();
    b.addEventListener("load", function (a) {
      f.image = a.content;
      f.needsUpdate = !0;
      c && c(f);
    });
    b.addEventListener("error", function (a) {
      d && d(a.message);
    });
    b.crossOrigin = this.crossOrigin;
    b.load(a, e);
    f.sourceFile = a;
    return f;
  },
  loadCompressedTexture: function (a, b, c, d) {
    var e = new THREE.CompressedTexture();
    e.mapping = b;
    var f = new XMLHttpRequest();
    f.onload = function () {
      var a = THREE.ImageUtils.parseDDS(f.response, !0);
      e.format = a.format;
      e.mipmaps = a.mipmaps;
      e.image.width = a.width;
      e.image.height = a.height;
      e.generateMipmaps = !1;
      e.needsUpdate = !0;
      c && c(e);
    };
    f.onerror = d;
    f.open("GET", a, !0);
    f.responseType = "arraybuffer";
    f.send(null);
    return e;
  },
  loadTextureCube: function (a, b, c, d) {
    var e = [];
    e.loadCount = 0;
    var f = new THREE.Texture();
    f.image = e;
    void 0 !== b && (f.mapping = b);
    f.flipY = !1;
    for (var b = 0, g = a.length; b < g; ++b) {
      var h = new Image();
      e[b] = h;
      h.onload = function () {
        e.loadCount += 1;
        6 === e.loadCount && ((f.needsUpdate = !0), c && c(f));
      };
      h.onerror = d;
      h.crossOrigin = this.crossOrigin;
      h.src = a[b];
    }
    return f;
  },
  loadCompressedTextureCube: function (a, b, c, d) {
    var e = [];
    e.loadCount = 0;
    var f = new THREE.CompressedTexture();
    f.image = e;
    void 0 !== b && (f.mapping = b);
    f.flipY = !1;
    f.generateMipmaps = !1;
    b = function (a, b) {
      return function () {
        var d = THREE.ImageUtils.parseDDS(a.response, !0);
        b.format = d.format;
        b.mipmaps = d.mipmaps;
        b.width = d.width;
        b.height = d.height;
        e.loadCount += 1;
        6 === e.loadCount &&
          ((f.format = d.format), (f.needsUpdate = !0), c && c(f));
      };
    };
    if (a instanceof Array)
      for (var g = 0, h = a.length; g < h; ++g) {
        var i = {};
        e[g] = i;
        var j = new XMLHttpRequest();
        j.onload = b(j, i);
        j.onerror = d;
        i = a[g];
        j.open("GET", i, !0);
        j.responseType = "arraybuffer";
        j.send(null);
      }
    else
      (j = new XMLHttpRequest()),
        (j.onload = function () {
          var a = THREE.ImageUtils.parseDDS(j.response, !0);
          if (a.isCubemap) {
            for (var b = a.mipmaps.length / a.mipmapCount, d = 0; d < b; d++) {
              e[d] = { mipmaps: [] };
              for (var g = 0; g < a.mipmapCount; g++)
                e[d].mipmaps.push(a.mipmaps[d * a.mipmapCount + g]),
                  (e[d].format = a.format),
                  (e[d].width = a.width),
                  (e[d].height = a.height);
            }
            f.format = a.format;
            f.needsUpdate = !0;
            c && c(f);
          }
        }),
        (j.onerror = d),
        j.open("GET", a, !0),
        (j.responseType = "arraybuffer"),
        j.send(null);
    return f;
  },
  parseDDS: function (a, b) {
    function c(a) {
      return (
        a.charCodeAt(0) +
        (a.charCodeAt(1) << 8) +
        (a.charCodeAt(2) << 16) +
        (a.charCodeAt(3) << 24)
      );
    }
    var d = { mipmaps: [], width: 0, height: 0, format: null, mipmapCount: 1 },
      e = c("DXT1"),
      f = c("DXT3"),
      g = c("DXT5"),
      h = new Int32Array(a, 0, 31);
    if (542327876 !== h[0])
      return (
        console.error(
          "ImageUtils.parseDDS(): Invalid magic number in DDS header"
        ),
        d
      );
    if (!h[20] & 4)
      return (
        console.error(
          "ImageUtils.parseDDS(): Unsupported format, must contain a FourCC code"
        ),
        d
      );
    var i = h[21];
    switch (i) {
      case e:
        e = 8;
        d.format = THREE.RGB_S3TC_DXT1_Format;
        break;
      case f:
        e = 16;
        d.format = THREE.RGBA_S3TC_DXT3_Format;
        break;
      case g:
        e = 16;
        d.format = THREE.RGBA_S3TC_DXT5_Format;
        break;
      default:
        return (
          console.error(
            "ImageUtils.parseDDS(): Unsupported FourCC code: ",
            String.fromCharCode(
              i & 255,
              (i >> 8) & 255,
              (i >> 16) & 255,
              (i >> 24) & 255
            )
          ),
          d
        );
    }
    d.mipmapCount = 1;
    h[2] & 131072 && !1 !== b && (d.mipmapCount = Math.max(1, h[7]));
    d.isCubemap = h[28] & 512 ? !0 : !1;
    d.width = h[4];
    d.height = h[3];
    for (
      var h = h[1] + 4,
        f = d.width,
        g = d.height,
        i = d.isCubemap ? 6 : 1,
        j = 0;
      j < i;
      j++
    ) {
      for (var m = 0; m < d.mipmapCount; m++) {
        var p = (((Math.max(4, f) / 4) * Math.max(4, g)) / 4) * e,
          l = { data: new Uint8Array(a, h, p), width: f, height: g };
        d.mipmaps.push(l);
        h += p;
        f = Math.max(0.5 * f, 1);
        g = Math.max(0.5 * g, 1);
      }
      f = d.width;
      g = d.height;
    }
    return d;
  },
  getNormalMap: function (a, b) {
    var c = function (a) {
        var b = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
        return [a[0] / b, a[1] / b, a[2] / b];
      },
      b = b | 1,
      d = a.width,
      e = a.height,
      f = document.createElement("canvas");
    f.width = d;
    f.height = e;
    var g = f.getContext("2d");
    g.drawImage(a, 0, 0);
    for (
      var h = g.getImageData(0, 0, d, e).data,
        i = g.createImageData(d, e),
        j = i.data,
        m = 0;
      m < d;
      m++
    )
      for (var p = 0; p < e; p++) {
        var l = 0 > p - 1 ? 0 : p - 1,
          r = p + 1 > e - 1 ? e - 1 : p + 1,
          s = 0 > m - 1 ? 0 : m - 1,
          n = m + 1 > d - 1 ? d - 1 : m + 1,
          q = [],
          y = [0, 0, (h[4 * (p * d + m)] / 255) * b];
        q.push([-1, 0, (h[4 * (p * d + s)] / 255) * b]);
        q.push([-1, -1, (h[4 * (l * d + s)] / 255) * b]);
        q.push([0, -1, (h[4 * (l * d + m)] / 255) * b]);
        q.push([1, -1, (h[4 * (l * d + n)] / 255) * b]);
        q.push([1, 0, (h[4 * (p * d + n)] / 255) * b]);
        q.push([1, 1, (h[4 * (r * d + n)] / 255) * b]);
        q.push([0, 1, (h[4 * (r * d + m)] / 255) * b]);
        q.push([-1, 1, (h[4 * (r * d + s)] / 255) * b]);
        l = [];
        s = q.length;
        for (r = 0; r < s; r++) {
          var n = q[r],
            u = q[(r + 1) % s],
            n = [n[0] - y[0], n[1] - y[1], n[2] - y[2]],
            u = [u[0] - y[0], u[1] - y[1], u[2] - y[2]];
          l.push(
            c([
              n[1] * u[2] - n[2] * u[1],
              n[2] * u[0] - n[0] * u[2],
              n[0] * u[1] - n[1] * u[0],
            ])
          );
        }
        q = [0, 0, 0];
        for (r = 0; r < l.length; r++)
          (q[0] += l[r][0]), (q[1] += l[r][1]), (q[2] += l[r][2]);
        q[0] /= l.length;
        q[1] /= l.length;
        q[2] /= l.length;
        y = 4 * (p * d + m);
        j[y] = (255 * ((q[0] + 1) / 2)) | 0;
        j[y + 1] = (255 * ((q[1] + 1) / 2)) | 0;
        j[y + 2] = (255 * q[2]) | 0;
        j[y + 3] = 255;
      }
    g.putImageData(i, 0, 0);
    return f;
  },
  generateDataTexture: function (a, b, c) {
    for (
      var d = a * b,
        e = new Uint8Array(3 * d),
        f = Math.floor(255 * c.r),
        g = Math.floor(255 * c.g),
        c = Math.floor(255 * c.b),
        h = 0;
      h < d;
      h++
    )
      (e[3 * h] = f), (e[3 * h + 1] = g), (e[3 * h + 2] = c);
    a = new THREE.DataTexture(e, a, b, THREE.RGBFormat);
    a.needsUpdate = !0;
    return a;
  },
};
THREE.SceneUtils = {
  createMultiMaterialObject: function (a, b) {
    for (var c = new THREE.Object3D(), d = 0, e = b.length; d < e; d++)
      c.add(new THREE.Mesh(a, b[d]));
    return c;
  },
  detach: function (a, b, c) {
    a.applyMatrix(b.matrixWorld);
    b.remove(a);
    c.add(a);
  },
  attach: function (a, b, c) {
    var d = new THREE.Matrix4();
    d.getInverse(c.matrixWorld);
    a.applyMatrix(d);
    b.remove(a);
    c.add(a);
  },
};
THREE.FontUtils = {
  faces: {},
  face: "helvetiker",
  weight: "normal",
  style: "normal",
  size: 150,
  divisions: 10,
  getFace: function () {
    return this.faces[this.face][this.weight][this.style];
  },
  loadFace: function (a) {
    var b = a.familyName.toLowerCase();
    this.faces[b] = this.faces[b] || {};
    this.faces[b][a.cssFontWeight] = this.faces[b][a.cssFontWeight] || {};
    this.faces[b][a.cssFontWeight][a.cssFontStyle] = a;
    return (this.faces[b][a.cssFontWeight][a.cssFontStyle] = a);
  },
  drawText: function (a) {
    for (
      var b = this.getFace(),
        c = this.size / b.resolution,
        d = 0,
        e = String(a).split(""),
        f = e.length,
        g = [],
        a = 0;
      a < f;
      a++
    ) {
      var h = new THREE.Path(),
        h = this.extractGlyphPoints(e[a], b, c, d, h),
        d = d + h.offset;
      g.push(h.path);
    }
    return { paths: g, offset: d / 2 };
  },
  extractGlyphPoints: function (a, b, c, d, e) {
    var f = [],
      g,
      h,
      i,
      j,
      m,
      p,
      l,
      r,
      s,
      n,
      q,
      y = b.glyphs[a] || b.glyphs["?"];
    if (y) {
      if (y.o) {
        b = y._cachedOutline || (y._cachedOutline = y.o.split(" "));
        j = b.length;
        for (a = 0; a < j; )
          switch (((i = b[a++]), i)) {
            case "m":
              i = b[a++] * c + d;
              m = b[a++] * c;
              e.moveTo(i, m);
              break;
            case "l":
              i = b[a++] * c + d;
              m = b[a++] * c;
              e.lineTo(i, m);
              break;
            case "q":
              i = b[a++] * c + d;
              m = b[a++] * c;
              r = b[a++] * c + d;
              s = b[a++] * c;
              e.quadraticCurveTo(r, s, i, m);
              if ((g = f[f.length - 1])) {
                p = g.x;
                l = g.y;
                g = 1;
                for (h = this.divisions; g <= h; g++) {
                  var u = g / h;
                  THREE.Shape.Utils.b2(u, p, r, i);
                  THREE.Shape.Utils.b2(u, l, s, m);
                }
              }
              break;
            case "b":
              if (
                ((i = b[a++] * c + d),
                (m = b[a++] * c),
                (r = b[a++] * c + d),
                (s = b[a++] * -c),
                (n = b[a++] * c + d),
                (q = b[a++] * -c),
                e.bezierCurveTo(i, m, r, s, n, q),
                (g = f[f.length - 1]))
              ) {
                p = g.x;
                l = g.y;
                g = 1;
                for (h = this.divisions; g <= h; g++)
                  (u = g / h),
                    THREE.Shape.Utils.b3(u, p, r, n, i),
                    THREE.Shape.Utils.b3(u, l, s, q, m);
              }
          }
      }
      return { offset: y.ha * c, path: e };
    }
  },
};
THREE.FontUtils.generateShapes = function (a, b) {
  var b = b || {},
    c = void 0 !== b.curveSegments ? b.curveSegments : 4,
    d = void 0 !== b.font ? b.font : "helvetiker",
    e = void 0 !== b.weight ? b.weight : "normal",
    f = void 0 !== b.style ? b.style : "normal";
  THREE.FontUtils.size = void 0 !== b.size ? b.size : 100;
  THREE.FontUtils.divisions = c;
  THREE.FontUtils.face = d;
  THREE.FontUtils.weight = e;
  THREE.FontUtils.style = f;
  c = THREE.FontUtils.drawText(a).paths;
  d = [];
  e = 0;
  for (f = c.length; e < f; e++) Array.prototype.push.apply(d, c[e].toShapes());
  return d;
};
(function (a) {
  var b = function (a) {
    for (var b = a.length, e = 0, f = b - 1, g = 0; g < b; f = g++)
      e += a[f].x * a[g].y - a[g].x * a[f].y;
    return 0.5 * e;
  };
  a.Triangulate = function (a, d) {
    var e = a.length;
    if (3 > e) return null;
    var f = [],
      g = [],
      h = [],
      i,
      j,
      m;
    if (0 < b(a)) for (j = 0; j < e; j++) g[j] = j;
    else for (j = 0; j < e; j++) g[j] = e - 1 - j;
    var p = 2 * e;
    for (j = e - 1; 2 < e; ) {
      if (0 >= p--) {
        console.log("Warning, unable to triangulate polygon!");
        break;
      }
      i = j;
      e <= i && (i = 0);
      j = i + 1;
      e <= j && (j = 0);
      m = j + 1;
      e <= m && (m = 0);
      var l;
      a: {
        var r = (l = void 0),
          s = void 0,
          n = void 0,
          q = void 0,
          y = void 0,
          u = void 0,
          x = void 0,
          t = void 0,
          r = a[g[i]].x,
          s = a[g[i]].y,
          n = a[g[j]].x,
          q = a[g[j]].y,
          y = a[g[m]].x,
          u = a[g[m]].y;
        if (1e-10 > (n - r) * (u - s) - (q - s) * (y - r)) l = !1;
        else {
          var E = void 0,
            J = void 0,
            F = void 0,
            z = void 0,
            H = void 0,
            K = void 0,
            G = void 0,
            L = void 0,
            B = void 0,
            V = void 0,
            B = (L = G = t = x = void 0),
            E = y - n,
            J = u - q,
            F = r - y,
            z = s - u,
            H = n - r,
            K = q - s;
          for (l = 0; l < e; l++)
            if (!(l === i || l === j || l === m))
              if (
                ((x = a[g[l]].x),
                (t = a[g[l]].y),
                (G = x - r),
                (L = t - s),
                (B = x - n),
                (V = t - q),
                (x -= y),
                (t -= u),
                (B = E * V - J * B),
                (G = H * L - K * G),
                (L = F * t - z * x),
                0 <= B && 0 <= L && 0 <= G)
              ) {
                l = !1;
                break a;
              }
          l = !0;
        }
      }
      if (l) {
        f.push([a[g[i]], a[g[j]], a[g[m]]]);
        h.push([g[i], g[j], g[m]]);
        i = j;
        for (m = j + 1; m < e; i++, m++) g[i] = g[m];
        e--;
        p = 2 * e;
      }
    }
    return d ? h : f;
  };
  a.Triangulate.area = b;
  return a;
})(THREE.FontUtils);
self._typeface_js = {
  faces: THREE.FontUtils.faces,
  loadFace: THREE.FontUtils.loadFace,
};
THREE.typeface_js = self._typeface_js;
THREE.Curve = function () {};
THREE.Curve.prototype.getPoint = function () {
  console.log("Warning, getPoint() not implemented!");
  return null;
};
THREE.Curve.prototype.getPointAt = function (a) {
  a = this.getUtoTmapping(a);
  return this.getPoint(a);
};
THREE.Curve.prototype.getPoints = function (a) {
  a || (a = 5);
  var b,
    c = [];
  for (b = 0; b <= a; b++) c.push(this.getPoint(b / a));
  return c;
};
THREE.Curve.prototype.getSpacedPoints = function (a) {
  a || (a = 5);
  var b,
    c = [];
  for (b = 0; b <= a; b++) c.push(this.getPointAt(b / a));
  return c;
};
THREE.Curve.prototype.getLength = function () {
  var a = this.getLengths();
  return a[a.length - 1];
};
THREE.Curve.prototype.getLengths = function (a) {
  a || (a = this.__arcLengthDivisions ? this.__arcLengthDivisions : 200);
  if (
    this.cacheArcLengths &&
    this.cacheArcLengths.length == a + 1 &&
    !this.needsUpdate
  )
    return this.cacheArcLengths;
  this.needsUpdate = !1;
  var b = [],
    c,
    d = this.getPoint(0),
    e,
    f = 0;
  b.push(0);
  for (e = 1; e <= a; e++)
    (c = this.getPoint(e / a)), (f += c.distanceTo(d)), b.push(f), (d = c);
  return (this.cacheArcLengths = b);
};
THREE.Curve.prototype.updateArcLengths = function () {
  this.needsUpdate = !0;
  this.getLengths();
};
THREE.Curve.prototype.getUtoTmapping = function (a, b) {
  var c = this.getLengths(),
    d = 0,
    e = c.length,
    f;
  f = b ? b : a * c[e - 1];
  for (var g = 0, h = e - 1, i; g <= h; )
    if (((d = Math.floor(g + (h - g) / 2)), (i = c[d] - f), 0 > i)) g = d + 1;
    else if (0 < i) h = d - 1;
    else {
      h = d;
      break;
    }
  d = h;
  if (c[d] == f) return d / (e - 1);
  g = c[d];
  return (c = (d + (f - g) / (c[d + 1] - g)) / (e - 1));
};
THREE.Curve.prototype.getTangent = function (a) {
  var b = a - 1e-4,
    a = a + 1e-4;
  0 > b && (b = 0);
  1 < a && (a = 1);
  b = this.getPoint(b);
  return this.getPoint(a).clone().sub(b).normalize();
};
THREE.Curve.prototype.getTangentAt = function (a) {
  a = this.getUtoTmapping(a);
  return this.getTangent(a);
};
THREE.LineCurve = function (a, b) {
  this.v1 = a;
  this.v2 = b;
};
THREE.LineCurve.prototype = Object.create(THREE.Curve.prototype);
THREE.LineCurve.prototype.getPoint = function (a) {
  var b = this.v2.clone().sub(this.v1);
  b.multiplyScalar(a).add(this.v1);
  return b;
};
THREE.LineCurve.prototype.getPointAt = function (a) {
  return this.getPoint(a);
};
THREE.LineCurve.prototype.getTangent = function () {
  return this.v2.clone().sub(this.v1).normalize();
};
THREE.QuadraticBezierCurve = function (a, b, c) {
  this.v0 = a;
  this.v1 = b;
  this.v2 = c;
};
THREE.QuadraticBezierCurve.prototype = Object.create(THREE.Curve.prototype);
THREE.QuadraticBezierCurve.prototype.getPoint = function (a) {
  var b;
  b = THREE.Shape.Utils.b2(a, this.v0.x, this.v1.x, this.v2.x);
  a = THREE.Shape.Utils.b2(a, this.v0.y, this.v1.y, this.v2.y);
  return new THREE.Vector2(b, a);
};
THREE.QuadraticBezierCurve.prototype.getTangent = function (a) {
  var b;
  b = THREE.Curve.Utils.tangentQuadraticBezier(
    a,
    this.v0.x,
    this.v1.x,
    this.v2.x
  );
  a = THREE.Curve.Utils.tangentQuadraticBezier(
    a,
    this.v0.y,
    this.v1.y,
    this.v2.y
  );
  b = new THREE.Vector2(b, a);
  b.normalize();
  return b;
};
THREE.CubicBezierCurve = function (a, b, c, d) {
  this.v0 = a;
  this.v1 = b;
  this.v2 = c;
  this.v3 = d;
};
THREE.CubicBezierCurve.prototype = Object.create(THREE.Curve.prototype);
THREE.CubicBezierCurve.prototype.getPoint = function (a) {
  var b;
  b = THREE.Shape.Utils.b3(a, this.v0.x, this.v1.x, this.v2.x, this.v3.x);
  a = THREE.Shape.Utils.b3(a, this.v0.y, this.v1.y, this.v2.y, this.v3.y);
  return new THREE.Vector2(b, a);
};
THREE.CubicBezierCurve.prototype.getTangent = function (a) {
  var b;
  b = THREE.Curve.Utils.tangentCubicBezier(
    a,
    this.v0.x,
    this.v1.x,
    this.v2.x,
    this.v3.x
  );
  a = THREE.Curve.Utils.tangentCubicBezier(
    a,
    this.v0.y,
    this.v1.y,
    this.v2.y,
    this.v3.y
  );
  b = new THREE.Vector2(b, a);
  b.normalize();
  return b;
};
THREE.SplineCurve = function (a) {
  this.points = void 0 == a ? [] : a;
};
THREE.SplineCurve.prototype = Object.create(THREE.Curve.prototype);
THREE.SplineCurve.prototype.getPoint = function (a) {
  var b = new THREE.Vector2(),
    c = [],
    d = this.points,
    e;
  e = (d.length - 1) * a;
  a = Math.floor(e);
  e -= a;
  c[0] = 0 == a ? a : a - 1;
  c[1] = a;
  c[2] = a > d.length - 2 ? d.length - 1 : a + 1;
  c[3] = a > d.length - 3 ? d.length - 1 : a + 2;
  b.x = THREE.Curve.Utils.interpolate(
    d[c[0]].x,
    d[c[1]].x,
    d[c[2]].x,
    d[c[3]].x,
    e
  );
  b.y = THREE.Curve.Utils.interpolate(
    d[c[0]].y,
    d[c[1]].y,
    d[c[2]].y,
    d[c[3]].y,
    e
  );
  return b;
};
THREE.EllipseCurve = function (a, b, c, d, e, f, g) {
  this.aX = a;
  this.aY = b;
  this.xRadius = c;
  this.yRadius = d;
  this.aStartAngle = e;
  this.aEndAngle = f;
  this.aClockwise = g;
};
THREE.EllipseCurve.prototype = Object.create(THREE.Curve.prototype);
THREE.EllipseCurve.prototype.getPoint = function (a) {
  var b = this.aEndAngle - this.aStartAngle;
  this.aClockwise || (a = 1 - a);
  b = this.aStartAngle + a * b;
  a = this.aX + this.xRadius * Math.cos(b);
  b = this.aY + this.yRadius * Math.sin(b);
  return new THREE.Vector2(a, b);
};
THREE.ArcCurve = function (a, b, c, d, e, f) {
  THREE.EllipseCurve.call(this, a, b, c, c, d, e, f);
};
THREE.ArcCurve.prototype = Object.create(THREE.EllipseCurve.prototype);
THREE.Curve.Utils = {
  tangentQuadraticBezier: function (a, b, c, d) {
    return 2 * (1 - a) * (c - b) + 2 * a * (d - c);
  },
  tangentCubicBezier: function (a, b, c, d, e) {
    return (
      -3 * b * (1 - a) * (1 - a) +
      3 * c * (1 - a) * (1 - a) -
      6 * a * c * (1 - a) +
      6 * a * d * (1 - a) -
      3 * a * a * d +
      3 * a * a * e
    );
  },
  tangentSpline: function (a) {
    return (
      6 * a * a -
      6 * a +
      (3 * a * a - 4 * a + 1) +
      (-6 * a * a + 6 * a) +
      (3 * a * a - 2 * a)
    );
  },
  interpolate: function (a, b, c, d, e) {
    var a = 0.5 * (c - a),
      d = 0.5 * (d - b),
      f = e * e;
    return (
      (2 * b - 2 * c + a + d) * e * f +
      (-3 * b + 3 * c - 2 * a - d) * f +
      a * e +
      b
    );
  },
};
THREE.Curve.create = function (a, b) {
  a.prototype = Object.create(THREE.Curve.prototype);
  a.prototype.getPoint = b;
  return a;
};
THREE.LineCurve3 = THREE.Curve.create(
  function (a, b) {
    this.v1 = a;
    this.v2 = b;
  },
  function (a) {
    var b = new THREE.Vector3();
    b.subVectors(this.v2, this.v1);
    b.multiplyScalar(a);
    b.add(this.v1);
    return b;
  }
);
THREE.QuadraticBezierCurve3 = THREE.Curve.create(
  function (a, b, c) {
    this.v0 = a;
    this.v1 = b;
    this.v2 = c;
  },
  function (a) {
    var b, c;
    b = THREE.Shape.Utils.b2(a, this.v0.x, this.v1.x, this.v2.x);
    c = THREE.Shape.Utils.b2(a, this.v0.y, this.v1.y, this.v2.y);
    a = THREE.Shape.Utils.b2(a, this.v0.z, this.v1.z, this.v2.z);
    return new THREE.Vector3(b, c, a);
  }
);
THREE.CubicBezierCurve3 = THREE.Curve.create(
  function (a, b, c, d) {
    this.v0 = a;
    this.v1 = b;
    this.v2 = c;
    this.v3 = d;
  },
  function (a) {
    var b, c;
    b = THREE.Shape.Utils.b3(a, this.v0.x, this.v1.x, this.v2.x, this.v3.x);
    c = THREE.Shape.Utils.b3(a, this.v0.y, this.v1.y, this.v2.y, this.v3.y);
    a = THREE.Shape.Utils.b3(a, this.v0.z, this.v1.z, this.v2.z, this.v3.z);
    return new THREE.Vector3(b, c, a);
  }
);
THREE.SplineCurve3 = THREE.Curve.create(
  function (a) {
    this.points = void 0 == a ? [] : a;
  },
  function (a) {
    var b = new THREE.Vector3(),
      c = [],
      d = this.points,
      e,
      a = (d.length - 1) * a;
    e = Math.floor(a);
    a -= e;
    c[0] = 0 == e ? e : e - 1;
    c[1] = e;
    c[2] = e > d.length - 2 ? d.length - 1 : e + 1;
    c[3] = e > d.length - 3 ? d.length - 1 : e + 2;
    e = d[c[0]];
    var f = d[c[1]],
      g = d[c[2]],
      c = d[c[3]];
    b.x = THREE.Curve.Utils.interpolate(e.x, f.x, g.x, c.x, a);
    b.y = THREE.Curve.Utils.interpolate(e.y, f.y, g.y, c.y, a);
    b.z = THREE.Curve.Utils.interpolate(e.z, f.z, g.z, c.z, a);
    return b;
  }
);
THREE.ClosedSplineCurve3 = THREE.Curve.create(
  function (a) {
    this.points = void 0 == a ? [] : a;
  },
  function (a) {
    var b = new THREE.Vector3(),
      c = [],
      d = this.points,
      e;
    e = (d.length - 0) * a;
    a = Math.floor(e);
    e -= a;
    a += 0 < a ? 0 : (Math.floor(Math.abs(a) / d.length) + 1) * d.length;
    c[0] = (a - 1) % d.length;
    c[1] = a % d.length;
    c[2] = (a + 1) % d.length;
    c[3] = (a + 2) % d.length;
    b.x = THREE.Curve.Utils.interpolate(
      d[c[0]].x,
      d[c[1]].x,
      d[c[2]].x,
      d[c[3]].x,
      e
    );
    b.y = THREE.Curve.Utils.interpolate(
      d[c[0]].y,
      d[c[1]].y,
      d[c[2]].y,
      d[c[3]].y,
      e
    );
    b.z = THREE.Curve.Utils.interpolate(
      d[c[0]].z,
      d[c[1]].z,
      d[c[2]].z,
      d[c[3]].z,
      e
    );
    return b;
  }
);
THREE.CurvePath = function () {
  this.curves = [];
  this.bends = [];
  this.autoClose = !1;
};
THREE.CurvePath.prototype = Object.create(THREE.Curve.prototype);
THREE.CurvePath.prototype.add = function (a) {
  this.curves.push(a);
};
THREE.CurvePath.prototype.checkConnection = function () {};
THREE.CurvePath.prototype.closePath = function () {
  var a = this.curves[0].getPoint(0),
    b = this.curves[this.curves.length - 1].getPoint(1);
  a.equals(b) || this.curves.push(new THREE.LineCurve(b, a));
};
THREE.CurvePath.prototype.getPoint = function (a) {
  for (
    var b = a * this.getLength(), c = this.getCurveLengths(), a = 0;
    a < c.length;

  ) {
    if (c[a] >= b)
      return (
        (b = c[a] - b),
        (a = this.curves[a]),
        (b = 1 - b / a.getLength()),
        a.getPointAt(b)
      );
    a++;
  }
  return null;
};
THREE.CurvePath.prototype.getLength = function () {
  var a = this.getCurveLengths();
  return a[a.length - 1];
};
THREE.CurvePath.prototype.getCurveLengths = function () {
  if (this.cacheLengths && this.cacheLengths.length == this.curves.length)
    return this.cacheLengths;
  var a = [],
    b = 0,
    c,
    d = this.curves.length;
  for (c = 0; c < d; c++) (b += this.curves[c].getLength()), a.push(b);
  return (this.cacheLengths = a);
};
THREE.CurvePath.prototype.getBoundingBox = function () {
  var a = this.getPoints(),
    b,
    c,
    d,
    e,
    f,
    g;
  b = c = Number.NEGATIVE_INFINITY;
  e = f = Number.POSITIVE_INFINITY;
  var h,
    i,
    j,
    m,
    p = a[0] instanceof THREE.Vector3;
  m = p ? new THREE.Vector3() : new THREE.Vector2();
  i = 0;
  for (j = a.length; i < j; i++)
    (h = a[i]),
      h.x > b ? (b = h.x) : h.x < e && (e = h.x),
      h.y > c ? (c = h.y) : h.y < f && (f = h.y),
      p && (h.z > d ? (d = h.z) : h.z < g && (g = h.z)),
      m.add(h);
  a = { minX: e, minY: f, maxX: b, maxY: c, centroid: m.divideScalar(j) };
  p && ((a.maxZ = d), (a.minZ = g));
  return a;
};
THREE.CurvePath.prototype.createPointsGeometry = function (a) {
  a = this.getPoints(a, !0);
  return this.createGeometry(a);
};
THREE.CurvePath.prototype.createSpacedPointsGeometry = function (a) {
  a = this.getSpacedPoints(a, !0);
  return this.createGeometry(a);
};
THREE.CurvePath.prototype.createGeometry = function (a) {
  for (var b = new THREE.Geometry(), c = 0; c < a.length; c++)
    b.vertices.push(new THREE.Vector3(a[c].x, a[c].y, a[c].z || 0));
  return b;
};
THREE.CurvePath.prototype.addWrapPath = function (a) {
  this.bends.push(a);
};
THREE.CurvePath.prototype.getTransformedPoints = function (a, b) {
  var c = this.getPoints(a),
    d,
    e;
  b || (b = this.bends);
  d = 0;
  for (e = b.length; d < e; d++) c = this.getWrapPoints(c, b[d]);
  return c;
};
THREE.CurvePath.prototype.getTransformedSpacedPoints = function (a, b) {
  var c = this.getSpacedPoints(a),
    d,
    e;
  b || (b = this.bends);
  d = 0;
  for (e = b.length; d < e; d++) c = this.getWrapPoints(c, b[d]);
  return c;
};
THREE.CurvePath.prototype.getWrapPoints = function (a, b) {
  var c = this.getBoundingBox(),
    d,
    e,
    f,
    g,
    h,
    i;
  d = 0;
  for (e = a.length; d < e; d++)
    (f = a[d]),
      (g = f.x),
      (h = f.y),
      (i = g / c.maxX),
      (i = b.getUtoTmapping(i, g)),
      (g = b.getPoint(i)),
      (h = b.getNormalVector(i).multiplyScalar(h)),
      (f.x = g.x + h.x),
      (f.y = g.y + h.y);
  return a;
};
THREE.Gyroscope = function () {
  THREE.Object3D.call(this);
};
THREE.Gyroscope.prototype = Object.create(THREE.Object3D.prototype);
THREE.Gyroscope.prototype.updateMatrixWorld = function (a) {
  this.matrixAutoUpdate && this.updateMatrix();
  if (this.matrixWorldNeedsUpdate || a)
    this.parent
      ? (this.matrixWorld.multiplyMatrices(
          this.parent.matrixWorld,
          this.matrix
        ),
        this.matrixWorld.decompose(
          this.translationWorld,
          this.rotationWorld,
          this.scaleWorld
        ),
        this.matrix.decompose(
          this.translationObject,
          this.rotationObject,
          this.scaleObject
        ),
        this.matrixWorld.makeFromPositionQuaternionScale(
          this.translationWorld,
          this.rotationObject,
          this.scaleWorld
        ))
      : this.matrixWorld.copy(this.matrix),
      (this.matrixWorldNeedsUpdate = !1),
      (a = !0);
  for (var b = 0, c = this.children.length; b < c; b++)
    this.children[b].updateMatrixWorld(a);
};
THREE.Gyroscope.prototype.translationWorld = new THREE.Vector3();
THREE.Gyroscope.prototype.translationObject = new THREE.Vector3();
THREE.Gyroscope.prototype.rotationWorld = new THREE.Quaternion();
THREE.Gyroscope.prototype.rotationObject = new THREE.Quaternion();
THREE.Gyroscope.prototype.scaleWorld = new THREE.Vector3();
THREE.Gyroscope.prototype.scaleObject = new THREE.Vector3();
THREE.Path = function (a) {
  THREE.CurvePath.call(this);
  this.actions = [];
  a && this.fromPoints(a);
};
THREE.Path.prototype = Object.create(THREE.CurvePath.prototype);
THREE.PathActions = {
  MOVE_TO: "moveTo",
  LINE_TO: "lineTo",
  QUADRATIC_CURVE_TO: "quadraticCurveTo",
  BEZIER_CURVE_TO: "bezierCurveTo",
  CSPLINE_THRU: "splineThru",
  ARC: "arc",
  ELLIPSE: "ellipse",
};
THREE.Path.prototype.fromPoints = function (a) {
  this.moveTo(a[0].x, a[0].y);
  for (var b = 1, c = a.length; b < c; b++) this.lineTo(a[b].x, a[b].y);
};
THREE.Path.prototype.moveTo = function (a, b) {
  var c = Array.prototype.slice.call(arguments);
  this.actions.push({ action: THREE.PathActions.MOVE_TO, args: c });
};
THREE.Path.prototype.lineTo = function (a, b) {
  var c = Array.prototype.slice.call(arguments),
    d = this.actions[this.actions.length - 1].args,
    d = new THREE.LineCurve(
      new THREE.Vector2(d[d.length - 2], d[d.length - 1]),
      new THREE.Vector2(a, b)
    );
  this.curves.push(d);
  this.actions.push({ action: THREE.PathActions.LINE_TO, args: c });
};
THREE.Path.prototype.quadraticCurveTo = function (a, b, c, d) {
  var e = Array.prototype.slice.call(arguments),
    f = this.actions[this.actions.length - 1].args,
    f = new THREE.QuadraticBezierCurve(
      new THREE.Vector2(f[f.length - 2], f[f.length - 1]),
      new THREE.Vector2(a, b),
      new THREE.Vector2(c, d)
    );
  this.curves.push(f);
  this.actions.push({ action: THREE.PathActions.QUADRATIC_CURVE_TO, args: e });
};
THREE.Path.prototype.bezierCurveTo = function (a, b, c, d, e, f) {
  var g = Array.prototype.slice.call(arguments),
    h = this.actions[this.actions.length - 1].args,
    h = new THREE.CubicBezierCurve(
      new THREE.Vector2(h[h.length - 2], h[h.length - 1]),
      new THREE.Vector2(a, b),
      new THREE.Vector2(c, d),
      new THREE.Vector2(e, f)
    );
  this.curves.push(h);
  this.actions.push({ action: THREE.PathActions.BEZIER_CURVE_TO, args: g });
};
THREE.Path.prototype.splineThru = function (a) {
  var b = Array.prototype.slice.call(arguments),
    c = this.actions[this.actions.length - 1].args,
    c = [new THREE.Vector2(c[c.length - 2], c[c.length - 1])];
  Array.prototype.push.apply(c, a);
  c = new THREE.SplineCurve(c);
  this.curves.push(c);
  this.actions.push({ action: THREE.PathActions.CSPLINE_THRU, args: b });
};
THREE.Path.prototype.arc = function (a, b, c, d, e, f) {
  var g = this.actions[this.actions.length - 1].args;
  this.absarc(a + g[g.length - 2], b + g[g.length - 1], c, d, e, f);
};
THREE.Path.prototype.absarc = function (a, b, c, d, e, f) {
  this.absellipse(a, b, c, c, d, e, f);
};
THREE.Path.prototype.ellipse = function (a, b, c, d, e, f, g) {
  var h = this.actions[this.actions.length - 1].args;
  this.absellipse(a + h[h.length - 2], b + h[h.length - 1], c, d, e, f, g);
};
THREE.Path.prototype.absellipse = function (a, b, c, d, e, f, g) {
  var h = Array.prototype.slice.call(arguments),
    i = new THREE.EllipseCurve(a, b, c, d, e, f, g);
  this.curves.push(i);
  i = i.getPoint(g ? 1 : 0);
  h.push(i.x);
  h.push(i.y);
  this.actions.push({ action: THREE.PathActions.ELLIPSE, args: h });
};
THREE.Path.prototype.getSpacedPoints = function (a) {
  a || (a = 40);
  for (var b = [], c = 0; c < a; c++) b.push(this.getPoint(c / a));
  return b;
};
THREE.Path.prototype.getPoints = function (a, b) {
  if (this.useSpacedPoints)
    return console.log("tata"), this.getSpacedPoints(a, b);
  var a = a || 12,
    c = [],
    d,
    e,
    f,
    g,
    h,
    i,
    j,
    m,
    p,
    l,
    r,
    s,
    n;
  d = 0;
  for (e = this.actions.length; d < e; d++)
    switch (((f = this.actions[d]), (g = f.action), (f = f.args), g)) {
      case THREE.PathActions.MOVE_TO:
        c.push(new THREE.Vector2(f[0], f[1]));
        break;
      case THREE.PathActions.LINE_TO:
        c.push(new THREE.Vector2(f[0], f[1]));
        break;
      case THREE.PathActions.QUADRATIC_CURVE_TO:
        h = f[2];
        i = f[3];
        p = f[0];
        l = f[1];
        0 < c.length
          ? ((g = c[c.length - 1]), (r = g.x), (s = g.y))
          : ((g = this.actions[d - 1].args),
            (r = g[g.length - 2]),
            (s = g[g.length - 1]));
        for (f = 1; f <= a; f++)
          (n = f / a),
            (g = THREE.Shape.Utils.b2(n, r, p, h)),
            (n = THREE.Shape.Utils.b2(n, s, l, i)),
            c.push(new THREE.Vector2(g, n));
        break;
      case THREE.PathActions.BEZIER_CURVE_TO:
        h = f[4];
        i = f[5];
        p = f[0];
        l = f[1];
        j = f[2];
        m = f[3];
        0 < c.length
          ? ((g = c[c.length - 1]), (r = g.x), (s = g.y))
          : ((g = this.actions[d - 1].args),
            (r = g[g.length - 2]),
            (s = g[g.length - 1]));
        for (f = 1; f <= a; f++)
          (n = f / a),
            (g = THREE.Shape.Utils.b3(n, r, p, j, h)),
            (n = THREE.Shape.Utils.b3(n, s, l, m, i)),
            c.push(new THREE.Vector2(g, n));
        break;
      case THREE.PathActions.CSPLINE_THRU:
        g = this.actions[d - 1].args;
        n = [new THREE.Vector2(g[g.length - 2], g[g.length - 1])];
        g = a * f[0].length;
        n = n.concat(f[0]);
        n = new THREE.SplineCurve(n);
        for (f = 1; f <= g; f++) c.push(n.getPointAt(f / g));
        break;
      case THREE.PathActions.ARC:
        h = f[0];
        i = f[1];
        l = f[2];
        j = f[3];
        g = f[4];
        p = !!f[5];
        r = g - j;
        s = 2 * a;
        for (f = 1; f <= s; f++)
          (n = f / s),
            p || (n = 1 - n),
            (n = j + n * r),
            (g = h + l * Math.cos(n)),
            (n = i + l * Math.sin(n)),
            c.push(new THREE.Vector2(g, n));
        break;
      case THREE.PathActions.ELLIPSE:
        h = f[0];
        i = f[1];
        l = f[2];
        m = f[3];
        j = f[4];
        g = f[5];
        p = !!f[6];
        r = g - j;
        s = 2 * a;
        for (f = 1; f <= s; f++)
          (n = f / s),
            p || (n = 1 - n),
            (n = j + n * r),
            (g = h + l * Math.cos(n)),
            (n = i + m * Math.sin(n)),
            c.push(new THREE.Vector2(g, n));
    }
  d = c[c.length - 1];
  1e-10 > Math.abs(d.x - c[0].x) &&
    1e-10 > Math.abs(d.y - c[0].y) &&
    c.splice(c.length - 1, 1);
  b && c.push(c[0]);
  return c;
};
THREE.Path.prototype.toShapes = function () {
  var a,
    b,
    c,
    d,
    e = [],
    f = new THREE.Path();
  a = 0;
  for (b = this.actions.length; a < b; a++)
    (c = this.actions[a]),
      (d = c.args),
      (c = c.action),
      c == THREE.PathActions.MOVE_TO &&
        0 != f.actions.length &&
        (e.push(f), (f = new THREE.Path())),
      f[c].apply(f, d);
  0 != f.actions.length && e.push(f);
  if (0 == e.length) return [];
  var g;
  d = [];
  a = !THREE.Shape.Utils.isClockWise(e[0].getPoints());
  if (1 == e.length)
    return (
      (f = e[0]),
      (g = new THREE.Shape()),
      (g.actions = f.actions),
      (g.curves = f.curves),
      d.push(g),
      d
    );
  if (a) {
    g = new THREE.Shape();
    a = 0;
    for (b = e.length; a < b; a++)
      (f = e[a]),
        THREE.Shape.Utils.isClockWise(f.getPoints())
          ? ((g.actions = f.actions),
            (g.curves = f.curves),
            d.push(g),
            (g = new THREE.Shape()))
          : g.holes.push(f);
  } else {
    a = 0;
    for (b = e.length; a < b; a++)
      (f = e[a]),
        THREE.Shape.Utils.isClockWise(f.getPoints())
          ? (g && d.push(g),
            (g = new THREE.Shape()),
            (g.actions = f.actions),
            (g.curves = f.curves))
          : g.holes.push(f);
    d.push(g);
  }
  return d;
};
THREE.Shape = function () {
  THREE.Path.apply(this, arguments);
  this.holes = [];
};
THREE.Shape.prototype = Object.create(THREE.Path.prototype);
THREE.Shape.prototype.extrude = function (a) {
  return new THREE.ExtrudeGeometry(this, a);
};
THREE.Shape.prototype.makeGeometry = function (a) {
  return new THREE.ShapeGeometry(this, a);
};
THREE.Shape.prototype.getPointsHoles = function (a) {
  var b,
    c = this.holes.length,
    d = [];
  for (b = 0; b < c; b++)
    d[b] = this.holes[b].getTransformedPoints(a, this.bends);
  return d;
};
THREE.Shape.prototype.getSpacedPointsHoles = function (a) {
  var b,
    c = this.holes.length,
    d = [];
  for (b = 0; b < c; b++)
    d[b] = this.holes[b].getTransformedSpacedPoints(a, this.bends);
  return d;
};
THREE.Shape.prototype.extractAllPoints = function (a) {
  return { shape: this.getTransformedPoints(a), holes: this.getPointsHoles(a) };
};
THREE.Shape.prototype.extractPoints = function (a) {
  return this.useSpacedPoints
    ? this.extractAllSpacedPoints(a)
    : this.extractAllPoints(a);
};
THREE.Shape.prototype.extractAllSpacedPoints = function (a) {
  return {
    shape: this.getTransformedSpacedPoints(a),
    holes: this.getSpacedPointsHoles(a),
  };
};
THREE.Shape.Utils = {
  removeHoles: function (a, b) {
    var c = a.concat(),
      d = c.concat(),
      e,
      f,
      g,
      h,
      i,
      j,
      m,
      p,
      l,
      r,
      s = [];
    for (i = 0; i < b.length; i++) {
      j = b[i];
      Array.prototype.push.apply(d, j);
      f = Number.POSITIVE_INFINITY;
      for (e = 0; e < j.length; e++) {
        l = j[e];
        r = [];
        for (p = 0; p < c.length; p++)
          (m = c[p]),
            (m = l.distanceToSquared(m)),
            r.push(m),
            m < f && ((f = m), (g = e), (h = p));
      }
      e = 0 <= h - 1 ? h - 1 : c.length - 1;
      f = 0 <= g - 1 ? g - 1 : j.length - 1;
      var n = [j[g], c[h], c[e]];
      p = THREE.FontUtils.Triangulate.area(n);
      var q = [j[g], j[f], c[h]];
      l = THREE.FontUtils.Triangulate.area(q);
      r = h;
      m = g;
      h += 1;
      g += -1;
      0 > h && (h += c.length);
      h %= c.length;
      0 > g && (g += j.length);
      g %= j.length;
      e = 0 <= h - 1 ? h - 1 : c.length - 1;
      f = 0 <= g - 1 ? g - 1 : j.length - 1;
      n = [j[g], c[h], c[e]];
      n = THREE.FontUtils.Triangulate.area(n);
      q = [j[g], j[f], c[h]];
      q = THREE.FontUtils.Triangulate.area(q);
      p + l > n + q &&
        ((h = r),
        (g = m),
        0 > h && (h += c.length),
        (h %= c.length),
        0 > g && (g += j.length),
        (g %= j.length),
        (e = 0 <= h - 1 ? h - 1 : c.length - 1),
        (f = 0 <= g - 1 ? g - 1 : j.length - 1));
      p = c.slice(0, h);
      l = c.slice(h);
      r = j.slice(g);
      m = j.slice(0, g);
      f = [j[g], j[f], c[h]];
      s.push([j[g], c[h], c[e]]);
      s.push(f);
      c = p.concat(r).concat(m).concat(l);
    }
    return { shape: c, isolatedPts: s, allpoints: d };
  },
  triangulateShape: function (a, b) {
    var c = THREE.Shape.Utils.removeHoles(a, b),
      d = c.allpoints,
      e = c.isolatedPts,
      c = THREE.FontUtils.Triangulate(c.shape, !1),
      f,
      g,
      h,
      i,
      j = {};
    f = 0;
    for (g = d.length; f < g; f++)
      (i = d[f].x + ":" + d[f].y),
        void 0 !== j[i] && console.log("Duplicate point", i),
        (j[i] = f);
    f = 0;
    for (g = c.length; f < g; f++) {
      h = c[f];
      for (d = 0; 3 > d; d++)
        (i = h[d].x + ":" + h[d].y), (i = j[i]), void 0 !== i && (h[d] = i);
    }
    f = 0;
    for (g = e.length; f < g; f++) {
      h = e[f];
      for (d = 0; 3 > d; d++)
        (i = h[d].x + ":" + h[d].y), (i = j[i]), void 0 !== i && (h[d] = i);
    }
    return c.concat(e);
  },
  isClockWise: function (a) {
    return 0 > THREE.FontUtils.Triangulate.area(a);
  },
  b2p0: function (a, b) {
    var c = 1 - a;
    return c * c * b;
  },
  b2p1: function (a, b) {
    return 2 * (1 - a) * a * b;
  },
  b2p2: function (a, b) {
    return a * a * b;
  },
  b2: function (a, b, c, d) {
    return this.b2p0(a, b) + this.b2p1(a, c) + this.b2p2(a, d);
  },
  b3p0: function (a, b) {
    var c = 1 - a;
    return c * c * c * b;
  },
  b3p1: function (a, b) {
    var c = 1 - a;
    return 3 * c * c * a * b;
  },
  b3p2: function (a, b) {
    return 3 * (1 - a) * a * a * b;
  },
  b3p3: function (a, b) {
    return a * a * a * b;
  },
  b3: function (a, b, c, d, e) {
    return (
      this.b3p0(a, b) + this.b3p1(a, c) + this.b3p2(a, d) + this.b3p3(a, e)
    );
  },
};
THREE.AnimationHandler = (function () {
  var a = [],
    b = {},
    c = {
      update: function (b) {
        for (var c = 0; c < a.length; c++) a[c].update(b);
      },
      addToUpdate: function (b) {
        -1 === a.indexOf(b) && a.push(b);
      },
      removeFromUpdate: function (b) {
        b = a.indexOf(b);
        -1 !== b && a.splice(b, 1);
      },
      add: function (a) {
        void 0 !== b[a.name] &&
          console.log(
            "THREE.AnimationHandler.add: Warning! " +
              a.name +
              " already exists in library. Overwriting."
          );
        b[a.name] = a;
        if (!0 !== a.initialized) {
          for (var c = 0; c < a.hierarchy.length; c++) {
            for (var d = 0; d < a.hierarchy[c].keys.length; d++)
              if (
                (0 > a.hierarchy[c].keys[d].time &&
                  (a.hierarchy[c].keys[d].time = 0),
                void 0 !== a.hierarchy[c].keys[d].rot &&
                  !(a.hierarchy[c].keys[d].rot instanceof THREE.Quaternion))
              ) {
                var h = a.hierarchy[c].keys[d].rot;
                a.hierarchy[c].keys[d].rot = new THREE.Quaternion(
                  h[0],
                  h[1],
                  h[2],
                  h[3]
                );
              }
            if (
              a.hierarchy[c].keys.length &&
              void 0 !== a.hierarchy[c].keys[0].morphTargets
            ) {
              h = {};
              for (d = 0; d < a.hierarchy[c].keys.length; d++)
                for (
                  var i = 0;
                  i < a.hierarchy[c].keys[d].morphTargets.length;
                  i++
                ) {
                  var j = a.hierarchy[c].keys[d].morphTargets[i];
                  h[j] = -1;
                }
              a.hierarchy[c].usedMorphTargets = h;
              for (d = 0; d < a.hierarchy[c].keys.length; d++) {
                var m = {};
                for (j in h) {
                  for (
                    i = 0;
                    i < a.hierarchy[c].keys[d].morphTargets.length;
                    i++
                  )
                    if (a.hierarchy[c].keys[d].morphTargets[i] === j) {
                      m[j] = a.hierarchy[c].keys[d].morphTargetsInfluences[i];
                      break;
                    }
                  i === a.hierarchy[c].keys[d].morphTargets.length &&
                    (m[j] = 0);
                }
                a.hierarchy[c].keys[d].morphTargetsInfluences = m;
              }
            }
            for (d = 1; d < a.hierarchy[c].keys.length; d++)
              a.hierarchy[c].keys[d].time === a.hierarchy[c].keys[d - 1].time &&
                (a.hierarchy[c].keys.splice(d, 1), d--);
            for (d = 0; d < a.hierarchy[c].keys.length; d++)
              a.hierarchy[c].keys[d].index = d;
          }
          d = parseInt(a.length * a.fps, 10);
          a.JIT = {};
          a.JIT.hierarchy = [];
          for (c = 0; c < a.hierarchy.length; c++)
            a.JIT.hierarchy.push(Array(d));
          a.initialized = !0;
        }
      },
      get: function (a) {
        if ("string" === typeof a) {
          if (b[a]) return b[a];
          console.log(
            "THREE.AnimationHandler.get: Couldn't find animation " + a
          );
          return null;
        }
      },
      parse: function (a) {
        var b = [];
        if (a instanceof THREE.SkinnedMesh)
          for (var c = 0; c < a.bones.length; c++) b.push(a.bones[c]);
        else d(a, b);
        return b;
      },
    },
    d = function (a, b) {
      b.push(a);
      for (var c = 0; c < a.children.length; c++) d(a.children[c], b);
    };
  c.LINEAR = 0;
  c.CATMULLROM = 1;
  c.CATMULLROM_FORWARD = 2;
  return c;
})();
THREE.Animation = function (a, b, c) {
  this.root = a;
  this.data = THREE.AnimationHandler.get(b);
  this.hierarchy = THREE.AnimationHandler.parse(a);
  this.currentTime = 0;
  this.timeScale = 1;
  this.isPlaying = !1;
  this.loop = this.isPaused = !0;
  this.interpolationType = void 0 !== c ? c : THREE.AnimationHandler.LINEAR;
  this.points = [];
  this.target = new THREE.Vector3();
};
THREE.Animation.prototype.play = function (a, b) {
  if (!1 === this.isPlaying) {
    this.isPlaying = !0;
    this.loop = void 0 !== a ? a : !0;
    this.currentTime = void 0 !== b ? b : 0;
    var c,
      d = this.hierarchy.length,
      e;
    for (c = 0; c < d; c++) {
      e = this.hierarchy[c];
      this.interpolationType !== THREE.AnimationHandler.CATMULLROM_FORWARD &&
        (e.useQuaternion = !0);
      e.matrixAutoUpdate = !0;
      void 0 === e.animationCache &&
        ((e.animationCache = {}),
        (e.animationCache.prevKey = { pos: 0, rot: 0, scl: 0 }),
        (e.animationCache.nextKey = { pos: 0, rot: 0, scl: 0 }),
        (e.animationCache.originalMatrix =
          e instanceof THREE.Bone ? e.skinMatrix : e.matrix));
      var f = e.animationCache.prevKey;
      e = e.animationCache.nextKey;
      f.pos = this.data.hierarchy[c].keys[0];
      f.rot = this.data.hierarchy[c].keys[0];
      f.scl = this.data.hierarchy[c].keys[0];
      e.pos = this.getNextKeyWith("pos", c, 1);
      e.rot = this.getNextKeyWith("rot", c, 1);
      e.scl = this.getNextKeyWith("scl", c, 1);
    }
    this.update(0);
  }
  this.isPaused = !1;
  THREE.AnimationHandler.addToUpdate(this);
};
THREE.Animation.prototype.pause = function () {
  !0 === this.isPaused
    ? THREE.AnimationHandler.addToUpdate(this)
    : THREE.AnimationHandler.removeFromUpdate(this);
  this.isPaused = !this.isPaused;
};
THREE.Animation.prototype.stop = function () {
  this.isPaused = this.isPlaying = !1;
  THREE.AnimationHandler.removeFromUpdate(this);
};
THREE.Animation.prototype.update = function (a) {
  if (!1 !== this.isPlaying) {
    var b = ["pos", "rot", "scl"],
      c,
      d,
      e,
      f,
      g,
      h,
      i,
      j,
      m;
    m = this.currentTime += a * this.timeScale;
    j = this.currentTime %= this.data.length;
    parseInt(Math.min(j * this.data.fps, this.data.length * this.data.fps), 10);
    for (var p = 0, l = this.hierarchy.length; p < l; p++) {
      a = this.hierarchy[p];
      i = a.animationCache;
      for (var r = 0; 3 > r; r++) {
        c = b[r];
        g = i.prevKey[c];
        h = i.nextKey[c];
        if (h.time <= m) {
          if (j < m)
            if (this.loop) {
              g = this.data.hierarchy[p].keys[0];
              for (h = this.getNextKeyWith(c, p, 1); h.time < j; )
                (g = h), (h = this.getNextKeyWith(c, p, h.index + 1));
            } else {
              this.stop();
              return;
            }
          else {
            do (g = h), (h = this.getNextKeyWith(c, p, h.index + 1));
            while (h.time < j);
          }
          i.prevKey[c] = g;
          i.nextKey[c] = h;
        }
        a.matrixAutoUpdate = !0;
        a.matrixWorldNeedsUpdate = !0;
        d = (j - g.time) / (h.time - g.time);
        e = g[c];
        f = h[c];
        if (0 > d || 1 < d)
          console.log(
            "THREE.Animation.update: Warning! Scale out of bounds:" +
              d +
              " on bone " +
              p
          ),
            (d = 0 > d ? 0 : 1);
        if ("pos" === c)
          if (
            ((c = a.position),
            this.interpolationType === THREE.AnimationHandler.LINEAR)
          )
            (c.x = e[0] + (f[0] - e[0]) * d),
              (c.y = e[1] + (f[1] - e[1]) * d),
              (c.z = e[2] + (f[2] - e[2]) * d);
          else {
            if (
              this.interpolationType === THREE.AnimationHandler.CATMULLROM ||
              this.interpolationType ===
                THREE.AnimationHandler.CATMULLROM_FORWARD
            )
              (this.points[0] = this.getPrevKeyWith("pos", p, g.index - 1).pos),
                (this.points[1] = e),
                (this.points[2] = f),
                (this.points[3] = this.getNextKeyWith(
                  "pos",
                  p,
                  h.index + 1
                ).pos),
                (d = 0.33 * d + 0.33),
                (e = this.interpolateCatmullRom(this.points, d)),
                (c.x = e[0]),
                (c.y = e[1]),
                (c.z = e[2]),
                this.interpolationType ===
                  THREE.AnimationHandler.CATMULLROM_FORWARD &&
                  ((d = this.interpolateCatmullRom(this.points, 1.01 * d)),
                  this.target.set(d[0], d[1], d[2]),
                  this.target.sub(c),
                  (this.target.y = 0),
                  this.target.normalize(),
                  (d = Math.atan2(this.target.x, this.target.z)),
                  a.rotation.set(0, d, 0));
          }
        else
          "rot" === c
            ? THREE.Quaternion.slerp(e, f, a.quaternion, d)
            : "scl" === c &&
              ((c = a.scale),
              (c.x = e[0] + (f[0] - e[0]) * d),
              (c.y = e[1] + (f[1] - e[1]) * d),
              (c.z = e[2] + (f[2] - e[2]) * d));
      }
    }
  }
};
THREE.Animation.prototype.interpolateCatmullRom = function (a, b) {
  var c = [],
    d = [],
    e,
    f,
    g,
    h,
    i,
    j;
  e = (a.length - 1) * b;
  f = Math.floor(e);
  e -= f;
  c[0] = 0 === f ? f : f - 1;
  c[1] = f;
  c[2] = f > a.length - 2 ? f : f + 1;
  c[3] = f > a.length - 3 ? f : f + 2;
  f = a[c[0]];
  h = a[c[1]];
  i = a[c[2]];
  j = a[c[3]];
  c = e * e;
  g = e * c;
  d[0] = this.interpolate(f[0], h[0], i[0], j[0], e, c, g);
  d[1] = this.interpolate(f[1], h[1], i[1], j[1], e, c, g);
  d[2] = this.interpolate(f[2], h[2], i[2], j[2], e, c, g);
  return d;
};
THREE.Animation.prototype.interpolate = function (a, b, c, d, e, f, g) {
  a = 0.5 * (c - a);
  d = 0.5 * (d - b);
  return (2 * (b - c) + a + d) * g + (-3 * (b - c) - 2 * a - d) * f + a * e + b;
};
THREE.Animation.prototype.getNextKeyWith = function (a, b, c) {
  for (
    var d = this.data.hierarchy[b].keys,
      c =
        this.interpolationType === THREE.AnimationHandler.CATMULLROM ||
        this.interpolationType === THREE.AnimationHandler.CATMULLROM_FORWARD
          ? c < d.length - 1
            ? c
            : d.length - 1
          : c % d.length;
    c < d.length;
    c++
  )
    if (void 0 !== d[c][a]) return d[c];
  return this.data.hierarchy[b].keys[0];
};
THREE.Animation.prototype.getPrevKeyWith = function (a, b, c) {
  for (
    var d = this.data.hierarchy[b].keys,
      c =
        this.interpolationType === THREE.AnimationHandler.CATMULLROM ||
        this.interpolationType === THREE.AnimationHandler.CATMULLROM_FORWARD
          ? 0 < c
            ? c
            : 0
          : 0 <= c
          ? c
          : c + d.length;
    0 <= c;
    c--
  )
    if (void 0 !== d[c][a]) return d[c];
  return this.data.hierarchy[b].keys[d.length - 1];
};
THREE.KeyFrameAnimation = function (a, b, c) {
  this.root = a;
  this.data = THREE.AnimationHandler.get(b);
  this.hierarchy = THREE.AnimationHandler.parse(a);
  this.currentTime = 0;
  this.timeScale = 0.001;
  this.isPlaying = !1;
  this.loop = this.isPaused = !0;
  this.JITCompile = void 0 !== c ? c : !0;
  a = 0;
  for (b = this.hierarchy.length; a < b; a++) {
    var c = this.data.hierarchy[a].sids,
      d = this.hierarchy[a];
    if (this.data.hierarchy[a].keys.length && c) {
      for (var e = 0; e < c.length; e++) {
        var f = c[e],
          g = this.getNextKeyWith(f, a, 0);
        g && g.apply(f);
      }
      d.matrixAutoUpdate = !1;
      this.data.hierarchy[a].node.updateMatrix();
      d.matrixWorldNeedsUpdate = !0;
    }
  }
};
THREE.KeyFrameAnimation.prototype.play = function (a, b) {
  if (!this.isPlaying) {
    this.isPlaying = !0;
    this.loop = void 0 !== a ? a : !0;
    this.currentTime = void 0 !== b ? b : 0;
    this.startTimeMs = b;
    this.startTime = 1e7;
    this.endTime = -this.startTime;
    var c,
      d = this.hierarchy.length,
      e,
      f;
    for (c = 0; c < d; c++)
      (e = this.hierarchy[c]),
        (f = this.data.hierarchy[c]),
        (e.useQuaternion = !0),
        void 0 === f.animationCache &&
          ((f.animationCache = {}),
          (f.animationCache.prevKey = null),
          (f.animationCache.nextKey = null),
          (f.animationCache.originalMatrix =
            e instanceof THREE.Bone ? e.skinMatrix : e.matrix)),
        (e = this.data.hierarchy[c].keys),
        e.length &&
          ((f.animationCache.prevKey = e[0]),
          (f.animationCache.nextKey = e[1]),
          (this.startTime = Math.min(e[0].time, this.startTime)),
          (this.endTime = Math.max(e[e.length - 1].time, this.endTime)));
    this.update(0);
  }
  this.isPaused = !1;
  THREE.AnimationHandler.addToUpdate(this);
};
THREE.KeyFrameAnimation.prototype.pause = function () {
  this.isPaused
    ? THREE.AnimationHandler.addToUpdate(this)
    : THREE.AnimationHandler.removeFromUpdate(this);
  this.isPaused = !this.isPaused;
};
THREE.KeyFrameAnimation.prototype.stop = function () {
  this.isPaused = this.isPlaying = !1;
  THREE.AnimationHandler.removeFromUpdate(this);
  for (var a = 0; a < this.data.hierarchy.length; a++) {
    var b = this.hierarchy[a],
      c = this.data.hierarchy[a];
    if (void 0 !== c.animationCache) {
      var d = c.animationCache.originalMatrix;
      b instanceof THREE.Bone
        ? (d.copy(b.skinMatrix), (b.skinMatrix = d))
        : (d.copy(b.matrix), (b.matrix = d));
      delete c.animationCache;
    }
  }
};
THREE.KeyFrameAnimation.prototype.update = function (a) {
  if (this.isPlaying) {
    var b,
      c,
      d,
      e,
      f = this.data.JIT.hierarchy,
      g,
      h,
      i;
    h = this.currentTime += a * this.timeScale;
    g = this.currentTime %= this.data.length;
    g < this.startTimeMs && (g = this.currentTime = this.startTimeMs + g);
    e = parseInt(
      Math.min(g * this.data.fps, this.data.length * this.data.fps),
      10
    );
    if ((i = g < h) && !this.loop) {
      for (var a = 0, j = this.hierarchy.length; a < j; a++) {
        var m = this.data.hierarchy[a].keys,
          f = this.data.hierarchy[a].sids;
        d = m.length - 1;
        e = this.hierarchy[a];
        if (m.length) {
          for (m = 0; m < f.length; m++)
            (g = f[m]), (h = this.getPrevKeyWith(g, a, d)) && h.apply(g);
          this.data.hierarchy[a].node.updateMatrix();
          e.matrixWorldNeedsUpdate = !0;
        }
      }
      this.stop();
    } else if (!(g < this.startTime)) {
      a = 0;
      for (j = this.hierarchy.length; a < j; a++) {
        d = this.hierarchy[a];
        b = this.data.hierarchy[a];
        var m = b.keys,
          p = b.animationCache;
        if (this.JITCompile && void 0 !== f[a][e])
          d instanceof THREE.Bone
            ? ((d.skinMatrix = f[a][e]), (d.matrixWorldNeedsUpdate = !1))
            : ((d.matrix = f[a][e]), (d.matrixWorldNeedsUpdate = !0));
        else if (m.length) {
          this.JITCompile &&
            p &&
            (d instanceof THREE.Bone
              ? (d.skinMatrix = p.originalMatrix)
              : (d.matrix = p.originalMatrix));
          b = p.prevKey;
          c = p.nextKey;
          if (b && c) {
            if (c.time <= h) {
              if (i && this.loop) {
                b = m[0];
                for (c = m[1]; c.time < g; ) (b = c), (c = m[b.index + 1]);
              } else if (!i)
                for (var l = m.length - 1; c.time < g && c.index !== l; )
                  (b = c), (c = m[b.index + 1]);
              p.prevKey = b;
              p.nextKey = c;
            }
            c.time >= g ? b.interpolate(c, g) : b.interpolate(c, c.time);
          }
          this.data.hierarchy[a].node.updateMatrix();
          d.matrixWorldNeedsUpdate = !0;
        }
      }
      if (this.JITCompile && void 0 === f[0][e]) {
        this.hierarchy[0].updateMatrixWorld(!0);
        for (a = 0; a < this.hierarchy.length; a++)
          f[a][e] =
            this.hierarchy[a] instanceof THREE.Bone
              ? this.hierarchy[a].skinMatrix.clone()
              : this.hierarchy[a].matrix.clone();
      }
    }
  }
};
THREE.KeyFrameAnimation.prototype.getNextKeyWith = function (a, b, c) {
  b = this.data.hierarchy[b].keys;
  for (c %= b.length; c < b.length; c++) if (b[c].hasTarget(a)) return b[c];
  return b[0];
};
THREE.KeyFrameAnimation.prototype.getPrevKeyWith = function (a, b, c) {
  b = this.data.hierarchy[b].keys;
  for (c = 0 <= c ? c : c + b.length; 0 <= c; c--)
    if (b[c].hasTarget(a)) return b[c];
  return b[b.length - 1];
};
THREE.CubeCamera = function (a, b, c) {
  THREE.Object3D.call(this);
  var d = new THREE.PerspectiveCamera(90, 1, a, b);
  d.up.set(0, -1, 0);
  d.lookAt(new THREE.Vector3(1, 0, 0));
  this.add(d);
  var e = new THREE.PerspectiveCamera(90, 1, a, b);
  e.up.set(0, -1, 0);
  e.lookAt(new THREE.Vector3(-1, 0, 0));
  this.add(e);
  var f = new THREE.PerspectiveCamera(90, 1, a, b);
  f.up.set(0, 0, 1);
  f.lookAt(new THREE.Vector3(0, 1, 0));
  this.add(f);
  var g = new THREE.PerspectiveCamera(90, 1, a, b);
  g.up.set(0, 0, -1);
  g.lookAt(new THREE.Vector3(0, -1, 0));
  this.add(g);
  var h = new THREE.PerspectiveCamera(90, 1, a, b);
  h.up.set(0, -1, 0);
  h.lookAt(new THREE.Vector3(0, 0, 1));
  this.add(h);
  var i = new THREE.PerspectiveCamera(90, 1, a, b);
  i.up.set(0, -1, 0);
  i.lookAt(new THREE.Vector3(0, 0, -1));
  this.add(i);
  this.renderTarget = new THREE.WebGLRenderTargetCube(c, c, {
    format: THREE.RGBFormat,
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearFilter,
  });
  this.updateCubeMap = function (a, b) {
    var c = this.renderTarget,
      l = c.generateMipmaps;
    c.generateMipmaps = !1;
    c.activeCubeFace = 0;
    a.render(b, d, c);
    c.activeCubeFace = 1;
    a.render(b, e, c);
    c.activeCubeFace = 2;
    a.render(b, f, c);
    c.activeCubeFace = 3;
    a.render(b, g, c);
    c.activeCubeFace = 4;
    a.render(b, h, c);
    c.generateMipmaps = l;
    c.activeCubeFace = 5;
    a.render(b, i, c);
  };
};
THREE.CubeCamera.prototype = Object.create(THREE.Object3D.prototype);
THREE.CombinedCamera = function (a, b, c, d, e, f, g) {
  THREE.Camera.call(this);
  this.fov = c;
  this.left = -a / 2;
  this.right = a / 2;
  this.top = b / 2;
  this.bottom = -b / 2;
  this.cameraO = new THREE.OrthographicCamera(
    a / -2,
    a / 2,
    b / 2,
    b / -2,
    f,
    g
  );
  this.cameraP = new THREE.PerspectiveCamera(c, a / b, d, e);
  this.zoom = 1;
  this.toPerspective();
};
THREE.CombinedCamera.prototype = Object.create(THREE.Camera.prototype);
THREE.CombinedCamera.prototype.toPerspective = function () {
  this.near = this.cameraP.near;
  this.far = this.cameraP.far;
  this.cameraP.fov = this.fov / this.zoom;
  this.cameraP.updateProjectionMatrix();
  this.projectionMatrix = this.cameraP.projectionMatrix;
  this.inPerspectiveMode = !0;
  this.inOrthographicMode = !1;
};
THREE.CombinedCamera.prototype.toOrthographic = function () {
  var a = this.cameraP.aspect,
    b = (this.cameraP.near + this.cameraP.far) / 2,
    b = Math.tan(this.fov / 2) * b,
    a = (2 * b * a) / 2,
    b = b / this.zoom,
    a = a / this.zoom;
  this.cameraO.left = -a;
  this.cameraO.right = a;
  this.cameraO.top = b;
  this.cameraO.bottom = -b;
  this.cameraO.updateProjectionMatrix();
  this.near = this.cameraO.near;
  this.far = this.cameraO.far;
  this.projectionMatrix = this.cameraO.projectionMatrix;
  this.inPerspectiveMode = !1;
  this.inOrthographicMode = !0;
};
THREE.CombinedCamera.prototype.setSize = function (a, b) {
  this.cameraP.aspect = a / b;
  this.left = -a / 2;
  this.right = a / 2;
  this.top = b / 2;
  this.bottom = -b / 2;
};
THREE.CombinedCamera.prototype.setFov = function (a) {
  this.fov = a;
  this.inPerspectiveMode ? this.toPerspective() : this.toOrthographic();
};
THREE.CombinedCamera.prototype.updateProjectionMatrix = function () {
  this.inPerspectiveMode
    ? this.toPerspective()
    : (this.toPerspective(), this.toOrthographic());
};
THREE.CombinedCamera.prototype.setLens = function (a, b) {
  void 0 === b && (b = 24);
  var c = 2 * THREE.Math.radToDeg(Math.atan(b / (2 * a)));
  this.setFov(c);
  return c;
};
THREE.CombinedCamera.prototype.setZoom = function (a) {
  this.zoom = a;
  this.inPerspectiveMode ? this.toPerspective() : this.toOrthographic();
};
THREE.CombinedCamera.prototype.toFrontView = function () {
  this.rotation.x = 0;
  this.rotation.y = 0;
  this.rotation.z = 0;
  this.rotationAutoUpdate = !1;
};
THREE.CombinedCamera.prototype.toBackView = function () {
  this.rotation.x = 0;
  this.rotation.y = Math.PI;
  this.rotation.z = 0;
  this.rotationAutoUpdate = !1;
};
THREE.CombinedCamera.prototype.toLeftView = function () {
  this.rotation.x = 0;
  this.rotation.y = -Math.PI / 2;
  this.rotation.z = 0;
  this.rotationAutoUpdate = !1;
};
THREE.CombinedCamera.prototype.toRightView = function () {
  this.rotation.x = 0;
  this.rotation.y = Math.PI / 2;
  this.rotation.z = 0;
  this.rotationAutoUpdate = !1;
};
THREE.CombinedCamera.prototype.toTopView = function () {
  this.rotation.x = -Math.PI / 2;
  this.rotation.y = 0;
  this.rotation.z = 0;
  this.rotationAutoUpdate = !1;
};
THREE.CombinedCamera.prototype.toBottomView = function () {
  this.rotation.x = Math.PI / 2;
  this.rotation.y = 0;
  this.rotation.z = 0;
  this.rotationAutoUpdate = !1;
};
THREE.CircleGeometry = function (a, b, c, d) {
  THREE.Geometry.call(this);
  var a = a || 50,
    c = void 0 !== c ? c : 0,
    d = void 0 !== d ? d : 2 * Math.PI,
    b = void 0 !== b ? Math.max(3, b) : 8,
    e,
    f = [];
  e = new THREE.Vector3();
  var g = new THREE.Vector2(0.5, 0.5);
  this.vertices.push(e);
  f.push(g);
  for (e = 0; e <= b; e++) {
    var h = new THREE.Vector3(),
      i = c + (e / b) * d;
    h.x = a * Math.cos(i);
    h.y = a * Math.sin(i);
    this.vertices.push(h);
    f.push(new THREE.Vector2((h.x / a + 1) / 2, (h.y / a + 1) / 2));
  }
  c = new THREE.Vector3(0, 0, 1);
  for (e = 1; e <= b; e++)
    this.faces.push(new THREE.Face3(e, e + 1, 0, [c, c, c])),
      this.faceVertexUvs[0].push([f[e], f[e + 1], g]);
  this.computeCentroids();
  this.computeFaceNormals();
  this.boundingSphere = new THREE.Sphere(new THREE.Vector3(), a);
};
THREE.CircleGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.CubeGeometry = function (a, b, c, d, e, f) {
  function g(a, b, c, d, e, f, g, n) {
    var q,
      y = h.widthSegments,
      u = h.heightSegments,
      x = e / 2,
      t = f / 2,
      E = h.vertices.length;
    if (("x" === a && "y" === b) || ("y" === a && "x" === b)) q = "z";
    else if (("x" === a && "z" === b) || ("z" === a && "x" === b))
      (q = "y"), (u = h.depthSegments);
    else if (("z" === a && "y" === b) || ("y" === a && "z" === b))
      (q = "x"), (y = h.depthSegments);
    var J = y + 1,
      F = u + 1,
      z = e / y,
      H = f / u,
      K = new THREE.Vector3();
    K[q] = 0 < g ? 1 : -1;
    for (e = 0; e < F; e++)
      for (f = 0; f < J; f++) {
        var G = new THREE.Vector3();
        G[a] = (f * z - x) * c;
        G[b] = (e * H - t) * d;
        G[q] = g;
        h.vertices.push(G);
      }
    for (e = 0; e < u; e++)
      for (f = 0; f < y; f++)
        (a = new THREE.Face4(
          f + J * e + E,
          f + J * (e + 1) + E,
          f + 1 + J * (e + 1) + E,
          f + 1 + J * e + E
        )),
          a.normal.copy(K),
          a.vertexNormals.push(K.clone(), K.clone(), K.clone(), K.clone()),
          (a.materialIndex = n),
          h.faces.push(a),
          h.faceVertexUvs[0].push([
            new THREE.Vector2(f / y, 1 - e / u),
            new THREE.Vector2(f / y, 1 - (e + 1) / u),
            new THREE.Vector2((f + 1) / y, 1 - (e + 1) / u),
            new THREE.Vector2((f + 1) / y, 1 - e / u),
          ]);
  }
  THREE.Geometry.call(this);
  var h = this;
  this.width = a;
  this.height = b;
  this.depth = c;
  this.widthSegments = d || 1;
  this.heightSegments = e || 1;
  this.depthSegments = f || 1;
  a = this.width / 2;
  b = this.height / 2;
  c = this.depth / 2;
  g("z", "y", -1, -1, this.depth, this.height, a, 0);
  g("z", "y", 1, -1, this.depth, this.height, -a, 1);
  g("x", "z", 1, 1, this.width, this.depth, b, 2);
  g("x", "z", 1, -1, this.width, this.depth, -b, 3);
  g("x", "y", 1, -1, this.width, this.height, c, 4);
  g("x", "y", -1, -1, this.width, this.height, -c, 5);
  this.computeCentroids();
  this.mergeVertices();
};
THREE.CubeGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.CylinderGeometry = function (a, b, c, d, e, f) {
  THREE.Geometry.call(this);
  this.radiusTop = a = void 0 !== a ? a : 20;
  this.radiusBottom = b = void 0 !== b ? b : 20;
  this.height = c = void 0 !== c ? c : 100;
  this.radiusSegments = d = d || 8;
  this.heightSegments = e = e || 1;
  this.openEnded = f = void 0 !== f ? f : !1;
  var g = c / 2,
    h,
    i,
    j = [],
    m = [];
  for (i = 0; i <= e; i++) {
    var p = [],
      l = [],
      r = i / e,
      s = r * (b - a) + a;
    for (h = 0; h <= d; h++) {
      var n = h / d,
        q = new THREE.Vector3();
      q.x = s * Math.sin(2 * n * Math.PI);
      q.y = -r * c + g;
      q.z = s * Math.cos(2 * n * Math.PI);
      this.vertices.push(q);
      p.push(this.vertices.length - 1);
      l.push(new THREE.Vector2(n, 1 - r));
    }
    j.push(p);
    m.push(l);
  }
  c = (b - a) / c;
  for (h = 0; h < d; h++) {
    0 !== a
      ? ((p = this.vertices[j[0][h]].clone()),
        (l = this.vertices[j[0][h + 1]].clone()))
      : ((p = this.vertices[j[1][h]].clone()),
        (l = this.vertices[j[1][h + 1]].clone()));
    p.setY(Math.sqrt(p.x * p.x + p.z * p.z) * c).normalize();
    l.setY(Math.sqrt(l.x * l.x + l.z * l.z) * c).normalize();
    for (i = 0; i < e; i++) {
      var r = j[i][h],
        s = j[i + 1][h],
        n = j[i + 1][h + 1],
        q = j[i][h + 1],
        y = p.clone(),
        u = p.clone(),
        x = l.clone(),
        t = l.clone(),
        E = m[i][h].clone(),
        J = m[i + 1][h].clone(),
        F = m[i + 1][h + 1].clone(),
        z = m[i][h + 1].clone();
      this.faces.push(new THREE.Face4(r, s, n, q, [y, u, x, t]));
      this.faceVertexUvs[0].push([E, J, F, z]);
    }
  }
  if (!1 === f && 0 < a) {
    this.vertices.push(new THREE.Vector3(0, g, 0));
    for (h = 0; h < d; h++)
      (r = j[0][h]),
        (s = j[0][h + 1]),
        (n = this.vertices.length - 1),
        (y = new THREE.Vector3(0, 1, 0)),
        (u = new THREE.Vector3(0, 1, 0)),
        (x = new THREE.Vector3(0, 1, 0)),
        (E = m[0][h].clone()),
        (J = m[0][h + 1].clone()),
        (F = new THREE.Vector2(J.u, 0)),
        this.faces.push(new THREE.Face3(r, s, n, [y, u, x])),
        this.faceVertexUvs[0].push([E, J, F]);
  }
  if (!1 === f && 0 < b) {
    this.vertices.push(new THREE.Vector3(0, -g, 0));
    for (h = 0; h < d; h++)
      (r = j[i][h + 1]),
        (s = j[i][h]),
        (n = this.vertices.length - 1),
        (y = new THREE.Vector3(0, -1, 0)),
        (u = new THREE.Vector3(0, -1, 0)),
        (x = new THREE.Vector3(0, -1, 0)),
        (E = m[i][h + 1].clone()),
        (J = m[i][h].clone()),
        (F = new THREE.Vector2(J.u, 1)),
        this.faces.push(new THREE.Face3(r, s, n, [y, u, x])),
        this.faceVertexUvs[0].push([E, J, F]);
  }
  this.computeCentroids();
  this.computeFaceNormals();
};
THREE.CylinderGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.ExtrudeGeometry = function (a, b) {
  "undefined" !== typeof a &&
    (THREE.Geometry.call(this),
    (a = a instanceof Array ? a : [a]),
    (this.shapebb = a[a.length - 1].getBoundingBox()),
    this.addShapeList(a, b),
    this.computeCentroids(),
    this.computeFaceNormals());
};
THREE.ExtrudeGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.ExtrudeGeometry.prototype.addShapeList = function (a, b) {
  for (var c = a.length, d = 0; d < c; d++) this.addShape(a[d], b);
};
THREE.ExtrudeGeometry.prototype.addShape = function (a, b) {
  function c(a, b, c) {
    b || console.log("die");
    return b.clone().multiplyScalar(c).add(a);
  }
  function d(a, b, c) {
    var d = THREE.ExtrudeGeometry.__v1,
      e = THREE.ExtrudeGeometry.__v2,
      f = THREE.ExtrudeGeometry.__v3,
      g = THREE.ExtrudeGeometry.__v4,
      h = THREE.ExtrudeGeometry.__v5,
      i = THREE.ExtrudeGeometry.__v6;
    d.set(a.x - b.x, a.y - b.y);
    e.set(a.x - c.x, a.y - c.y);
    d = d.normalize();
    e = e.normalize();
    f.set(-d.y, d.x);
    g.set(e.y, -e.x);
    h.copy(a).add(f);
    i.copy(a).add(g);
    if (h.equals(i)) return g.clone();
    h.copy(b).add(f);
    i.copy(c).add(g);
    f = d.dot(g);
    g = i.sub(h).dot(g);
    0 === f &&
      (console.log("Either infinite or no solutions!"),
      0 === g
        ? console.log("Its finite solutions.")
        : console.log("Too bad, no solutions."));
    g /= f;
    return 0 > g
      ? ((b = Math.atan2(b.y - a.y, b.x - a.x)),
        (a = Math.atan2(c.y - a.y, c.x - a.x)),
        b > a && (a += 2 * Math.PI),
        (c = (b + a) / 2),
        (a = -Math.cos(c)),
        (c = -Math.sin(c)),
        new THREE.Vector2(a, c))
      : d.multiplyScalar(g).add(h).sub(a).clone();
  }
  function e(c, d) {
    var e, f;
    for (A = c.length; 0 <= --A; ) {
      e = A;
      f = A - 1;
      0 > f && (f = c.length - 1);
      for (var g = 0, h = r + 2 * m, g = 0; g < h; g++) {
        var i = ea * g,
          j = ea * (g + 1),
          l = d + e + i,
          i = d + f + i,
          p = d + f + j,
          j = d + e + j,
          n = c,
          q = g,
          s = h,
          t = e,
          y = f,
          l = l + L,
          i = i + L,
          p = p + L,
          j = j + L;
        G.faces.push(new THREE.Face4(l, i, p, j, null, null, u));
        l = x.generateSideWallUV(G, a, n, b, l, i, p, j, q, s, t, y);
        G.faceVertexUvs[0].push(l);
      }
    }
  }
  function f(a, b, c) {
    G.vertices.push(new THREE.Vector3(a, b, c));
  }
  function g(c, d, e, f) {
    c += L;
    d += L;
    e += L;
    G.faces.push(new THREE.Face3(c, d, e, null, null, y));
    c = f
      ? x.generateBottomUV(G, a, b, c, d, e)
      : x.generateTopUV(G, a, b, c, d, e);
    G.faceVertexUvs[0].push(c);
  }
  var h = void 0 !== b.amount ? b.amount : 100,
    i = void 0 !== b.bevelThickness ? b.bevelThickness : 6,
    j = void 0 !== b.bevelSize ? b.bevelSize : i - 2,
    m = void 0 !== b.bevelSegments ? b.bevelSegments : 3,
    p = void 0 !== b.bevelEnabled ? b.bevelEnabled : !0,
    l = void 0 !== b.curveSegments ? b.curveSegments : 12,
    r = void 0 !== b.steps ? b.steps : 1,
    s = b.extrudePath,
    n,
    q = !1,
    y = b.material,
    u = b.extrudeMaterial,
    x =
      void 0 !== b.UVGenerator
        ? b.UVGenerator
        : THREE.ExtrudeGeometry.WorldUVGenerator,
    t,
    E,
    J,
    F;
  s &&
    ((n = s.getSpacedPoints(r)),
    (q = !0),
    (p = !1),
    (t =
      void 0 !== b.frames
        ? b.frames
        : new THREE.TubeGeometry.FrenetFrames(s, r, !1)),
    (E = new THREE.Vector3()),
    (J = new THREE.Vector3()),
    (F = new THREE.Vector3()));
  p || (j = i = m = 0);
  var z,
    H,
    K,
    G = this,
    L = this.vertices.length,
    l = a.extractPoints(l),
    B = l.shape,
    l = l.holes;
  if ((s = !THREE.Shape.Utils.isClockWise(B))) {
    B = B.reverse();
    H = 0;
    for (K = l.length; H < K; H++)
      (z = l[H]), THREE.Shape.Utils.isClockWise(z) && (l[H] = z.reverse());
    s = !1;
  }
  var V = THREE.Shape.Utils.triangulateShape(B, l),
    s = B;
  H = 0;
  for (K = l.length; H < K; H++) (z = l[H]), (B = B.concat(z));
  var C,
    I,
    M,
    R,
    ea = B.length,
    wa = V.length,
    Ma = [],
    A = 0,
    ca = s.length;
  C = ca - 1;
  for (I = A + 1; A < ca; A++, C++, I++)
    C === ca && (C = 0), I === ca && (I = 0), (Ma[A] = d(s[A], s[C], s[I]));
  var ja = [],
    na,
    N = Ma.concat();
  H = 0;
  for (K = l.length; H < K; H++) {
    z = l[H];
    na = [];
    A = 0;
    ca = z.length;
    C = ca - 1;
    for (I = A + 1; A < ca; A++, C++, I++)
      C === ca && (C = 0), I === ca && (I = 0), (na[A] = d(z[A], z[C], z[I]));
    ja.push(na);
    N = N.concat(na);
  }
  for (C = 0; C < m; C++) {
    z = C / m;
    M = i * (1 - z);
    I = j * Math.sin((z * Math.PI) / 2);
    A = 0;
    for (ca = s.length; A < ca; A++) (R = c(s[A], Ma[A], I)), f(R.x, R.y, -M);
    H = 0;
    for (K = l.length; H < K; H++) {
      z = l[H];
      na = ja[H];
      A = 0;
      for (ca = z.length; A < ca; A++) (R = c(z[A], na[A], I)), f(R.x, R.y, -M);
    }
  }
  I = j;
  for (A = 0; A < ea; A++)
    (R = p ? c(B[A], N[A], I) : B[A]),
      q
        ? (J.copy(t.normals[0]).multiplyScalar(R.x),
          E.copy(t.binormals[0]).multiplyScalar(R.y),
          F.copy(n[0]).add(J).add(E),
          f(F.x, F.y, F.z))
        : f(R.x, R.y, 0);
  for (z = 1; z <= r; z++)
    for (A = 0; A < ea; A++)
      (R = p ? c(B[A], N[A], I) : B[A]),
        q
          ? (J.copy(t.normals[z]).multiplyScalar(R.x),
            E.copy(t.binormals[z]).multiplyScalar(R.y),
            F.copy(n[z]).add(J).add(E),
            f(F.x, F.y, F.z))
          : f(R.x, R.y, (h / r) * z);
  for (C = m - 1; 0 <= C; C--) {
    z = C / m;
    M = i * (1 - z);
    I = j * Math.sin((z * Math.PI) / 2);
    A = 0;
    for (ca = s.length; A < ca; A++)
      (R = c(s[A], Ma[A], I)), f(R.x, R.y, h + M);
    H = 0;
    for (K = l.length; H < K; H++) {
      z = l[H];
      na = ja[H];
      A = 0;
      for (ca = z.length; A < ca; A++)
        (R = c(z[A], na[A], I)),
          q ? f(R.x, R.y + n[r - 1].y, n[r - 1].x + M) : f(R.x, R.y, h + M);
    }
  }
  if (p) {
    i = 0 * ea;
    for (A = 0; A < wa; A++) (h = V[A]), g(h[2] + i, h[1] + i, h[0] + i, !0);
    i = ea * (r + 2 * m);
    for (A = 0; A < wa; A++) (h = V[A]), g(h[0] + i, h[1] + i, h[2] + i, !1);
  } else {
    for (A = 0; A < wa; A++) (h = V[A]), g(h[2], h[1], h[0], !0);
    for (A = 0; A < wa; A++)
      (h = V[A]), g(h[0] + ea * r, h[1] + ea * r, h[2] + ea * r, !1);
  }
  h = 0;
  e(s, h);
  h += s.length;
  H = 0;
  for (K = l.length; H < K; H++) (z = l[H]), e(z, h), (h += z.length);
};
THREE.ExtrudeGeometry.WorldUVGenerator = {
  generateTopUV: function (a, b, c, d, e, f) {
    b = a.vertices[e].x;
    e = a.vertices[e].y;
    c = a.vertices[f].x;
    f = a.vertices[f].y;
    return [
      new THREE.Vector2(a.vertices[d].x, a.vertices[d].y),
      new THREE.Vector2(b, e),
      new THREE.Vector2(c, f),
    ];
  },
  generateBottomUV: function (a, b, c, d, e, f) {
    return this.generateTopUV(a, b, c, d, e, f);
  },
  generateSideWallUV: function (a, b, c, d, e, f, g, h) {
    var b = a.vertices[e].x,
      c = a.vertices[e].y,
      e = a.vertices[e].z,
      d = a.vertices[f].x,
      i = a.vertices[f].y,
      f = a.vertices[f].z,
      j = a.vertices[g].x,
      m = a.vertices[g].y,
      g = a.vertices[g].z,
      p = a.vertices[h].x,
      l = a.vertices[h].y,
      a = a.vertices[h].z;
    return 0.01 > Math.abs(c - i)
      ? [
          new THREE.Vector2(b, 1 - e),
          new THREE.Vector2(d, 1 - f),
          new THREE.Vector2(j, 1 - g),
          new THREE.Vector2(p, 1 - a),
        ]
      : [
          new THREE.Vector2(c, 1 - e),
          new THREE.Vector2(i, 1 - f),
          new THREE.Vector2(m, 1 - g),
          new THREE.Vector2(l, 1 - a),
        ];
  },
};
THREE.ExtrudeGeometry.__v1 = new THREE.Vector2();
THREE.ExtrudeGeometry.__v2 = new THREE.Vector2();
THREE.ExtrudeGeometry.__v3 = new THREE.Vector2();
THREE.ExtrudeGeometry.__v4 = new THREE.Vector2();
THREE.ExtrudeGeometry.__v5 = new THREE.Vector2();
THREE.ExtrudeGeometry.__v6 = new THREE.Vector2();
THREE.ShapeGeometry = function (a, b) {
  THREE.Geometry.call(this);
  !1 === a instanceof Array && (a = [a]);
  this.shapebb = a[a.length - 1].getBoundingBox();
  this.addShapeList(a, b);
  this.computeCentroids();
  this.computeFaceNormals();
};
THREE.ShapeGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.ShapeGeometry.prototype.addShapeList = function (a, b) {
  for (var c = 0, d = a.length; c < d; c++) this.addShape(a[c], b);
  return this;
};
THREE.ShapeGeometry.prototype.addShape = function (a, b) {
  void 0 === b && (b = {});
  var c = b.material,
    d =
      void 0 === b.UVGenerator
        ? THREE.ExtrudeGeometry.WorldUVGenerator
        : b.UVGenerator,
    e,
    f,
    g,
    h = this.vertices.length;
  e = a.extractPoints(void 0 !== b.curveSegments ? b.curveSegments : 12);
  var i = e.shape,
    j = e.holes;
  if (!THREE.Shape.Utils.isClockWise(i)) {
    i = i.reverse();
    e = 0;
    for (f = j.length; e < f; e++)
      (g = j[e]), THREE.Shape.Utils.isClockWise(g) && (j[e] = g.reverse());
  }
  var m = THREE.Shape.Utils.triangulateShape(i, j);
  e = 0;
  for (f = j.length; e < f; e++) (g = j[e]), (i = i.concat(g));
  j = i.length;
  f = m.length;
  for (e = 0; e < j; e++)
    (g = i[e]), this.vertices.push(new THREE.Vector3(g.x, g.y, 0));
  for (e = 0; e < f; e++)
    (j = m[e]),
      (i = j[0] + h),
      (g = j[1] + h),
      (j = j[2] + h),
      this.faces.push(new THREE.Face3(i, g, j, null, null, c)),
      this.faceVertexUvs[0].push(d.generateBottomUV(this, a, b, i, g, j));
};
THREE.LatheGeometry = function (a, b, c, d) {
  THREE.Geometry.call(this);
  for (
    var b = b || 12,
      c = c || 0,
      d = d || 2 * Math.PI,
      e = 1 / (a.length - 1),
      f = 1 / b,
      g = 0,
      h = b;
    g <= h;
    g++
  )
    for (
      var i = c + g * f * d,
        j = Math.cos(i),
        m = Math.sin(i),
        i = 0,
        p = a.length;
      i < p;
      i++
    ) {
      var l = a[i],
        r = new THREE.Vector3();
      r.x = j * l.x - m * l.y;
      r.y = m * l.x + j * l.y;
      r.z = l.z;
      this.vertices.push(r);
    }
  c = a.length;
  g = 0;
  for (h = b; g < h; g++) {
    i = 0;
    for (p = a.length - 1; i < p; i++)
      (d = b = i + c * g),
        (m = b + c),
        (j = b + 1 + c),
        this.faces.push(new THREE.Face4(d, m, j, b + 1)),
        (j = g * f),
        (b = i * e),
        (d = j + f),
        (m = b + e),
        this.faceVertexUvs[0].push([
          new THREE.Vector2(j, b),
          new THREE.Vector2(d, b),
          new THREE.Vector2(d, m),
          new THREE.Vector2(j, m),
        ]);
  }
  this.mergeVertices();
  this.computeCentroids();
  this.computeFaceNormals();
  this.computeVertexNormals();
};
THREE.LatheGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.PlaneGeometry = function (a, b, c, d) {
  THREE.Geometry.call(this);
  this.width = a;
  this.height = b;
  this.widthSegments = c || 1;
  this.heightSegments = d || 1;
  for (
    var c = a / 2,
      e = b / 2,
      d = this.widthSegments,
      f = this.heightSegments,
      g = d + 1,
      h = f + 1,
      i = this.width / d,
      j = this.height / f,
      m = new THREE.Vector3(0, 0, 1),
      a = 0;
    a < h;
    a++
  )
    for (b = 0; b < g; b++)
      this.vertices.push(new THREE.Vector3(b * i - c, -(a * j - e), 0));
  for (a = 0; a < f; a++)
    for (b = 0; b < d; b++)
      (c = new THREE.Face4(
        b + g * a,
        b + g * (a + 1),
        b + 1 + g * (a + 1),
        b + 1 + g * a
      )),
        c.normal.copy(m),
        c.vertexNormals.push(m.clone(), m.clone(), m.clone(), m.clone()),
        this.faces.push(c),
        this.faceVertexUvs[0].push([
          new THREE.Vector2(b / d, 1 - a / f),
          new THREE.Vector2(b / d, 1 - (a + 1) / f),
          new THREE.Vector2((b + 1) / d, 1 - (a + 1) / f),
          new THREE.Vector2((b + 1) / d, 1 - a / f),
        ]);
  this.computeCentroids();
};
THREE.PlaneGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.RingGeometry = function (a, b, c, d, e, f) {
  THREE.Geometry.call(this);
  for (
    var a = a || 0,
      b = b || 50,
      e = void 0 !== e ? e : 0,
      f = void 0 !== f ? f : 2 * Math.PI,
      c = void 0 !== c ? Math.max(3, c) : 8,
      d = void 0 !== d ? Math.max(3, d) : 8,
      g = [],
      h = a,
      i = (b - a) / d,
      a = 0;
    a <= d;
    a++
  ) {
    for (b = 0; b <= c; b++) {
      var j = new THREE.Vector3(),
        m = e + (b / c) * f;
      j.x = h * Math.cos(m);
      j.y = h * Math.sin(m);
      this.vertices.push(j);
      g.push(new THREE.Vector2((j.x / h + 1) / 2, -(j.y / h + 1) / 2 + 1));
    }
    h += i;
  }
  e = new THREE.Vector3(0, 0, 1);
  for (a = 0; a < d; a++) {
    f = a * c;
    for (b = 0; b <= c; b++) {
      var m = b + f,
        i = m + a,
        j = m + c + a,
        p = m + c + 1 + a;
      this.faces.push(new THREE.Face3(i, j, p, [e, e, e]));
      this.faceVertexUvs[0].push([g[i], g[j], g[p]]);
      i = m + a;
      j = m + c + 1 + a;
      p = m + 1 + a;
      this.faces.push(new THREE.Face3(i, j, p, [e, e, e]));
      this.faceVertexUvs[0].push([g[i], g[j], g[p]]);
    }
  }
  this.computeCentroids();
  this.computeFaceNormals();
  this.boundingSphere = new THREE.Sphere(new THREE.Vector3(), h);
};
THREE.RingGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.SphereGeometry = function (a, b, c, d, e, f, g) {
  THREE.Geometry.call(this);
  this.radius = a = a || 50;
  this.widthSegments = b = Math.max(3, Math.floor(b) || 8);
  this.heightSegments = c = Math.max(2, Math.floor(c) || 6);
  this.phiStart = d = void 0 !== d ? d : 0;
  this.phiLength = e = void 0 !== e ? e : 2 * Math.PI;
  this.thetaStart = f = void 0 !== f ? f : 0;
  this.thetaLength = g = void 0 !== g ? g : Math.PI;
  var h,
    i,
    j = [],
    m = [];
  for (i = 0; i <= c; i++) {
    var p = [],
      l = [];
    for (h = 0; h <= b; h++) {
      var r = h / b,
        s = i / c,
        n = new THREE.Vector3();
      n.x = -a * Math.cos(d + r * e) * Math.sin(f + s * g);
      n.y = a * Math.cos(f + s * g);
      n.z = a * Math.sin(d + r * e) * Math.sin(f + s * g);
      this.vertices.push(n);
      p.push(this.vertices.length - 1);
      l.push(new THREE.Vector2(r, 1 - s));
    }
    j.push(p);
    m.push(l);
  }
  for (i = 0; i < this.heightSegments; i++)
    for (h = 0; h < this.widthSegments; h++) {
      var b = j[i][h + 1],
        c = j[i][h],
        d = j[i + 1][h],
        e = j[i + 1][h + 1],
        f = this.vertices[b].clone().normalize(),
        g = this.vertices[c].clone().normalize(),
        p = this.vertices[d].clone().normalize(),
        l = this.vertices[e].clone().normalize(),
        r = m[i][h + 1].clone(),
        s = m[i][h].clone(),
        n = m[i + 1][h].clone(),
        q = m[i + 1][h + 1].clone();
      Math.abs(this.vertices[b].y) === this.radius
        ? (this.faces.push(new THREE.Face3(b, d, e, [f, p, l])),
          this.faceVertexUvs[0].push([r, n, q]))
        : Math.abs(this.vertices[d].y) === this.radius
        ? (this.faces.push(new THREE.Face3(b, c, d, [f, g, p])),
          this.faceVertexUvs[0].push([r, s, n]))
        : (this.faces.push(new THREE.Face4(b, c, d, e, [f, g, p, l])),
          this.faceVertexUvs[0].push([r, s, n, q]));
    }
  this.computeCentroids();
  this.computeFaceNormals();
  this.boundingSphere = new THREE.Sphere(new THREE.Vector3(), a);
};
THREE.SphereGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.TextGeometry = function (a, b) {
  var b = b || {},
    c = THREE.FontUtils.generateShapes(a, b);
  b.amount = void 0 !== b.height ? b.height : 50;
  void 0 === b.bevelThickness && (b.bevelThickness = 10);
  void 0 === b.bevelSize && (b.bevelSize = 8);
  void 0 === b.bevelEnabled && (b.bevelEnabled = !1);
  THREE.ExtrudeGeometry.call(this, c, b);
};
THREE.TextGeometry.prototype = Object.create(THREE.ExtrudeGeometry.prototype);
THREE.TorusGeometry = function (a, b, c, d, e) {
  THREE.Geometry.call(this);
  this.radius = a || 100;
  this.tube = b || 40;
  this.radialSegments = c || 8;
  this.tubularSegments = d || 6;
  this.arc = e || 2 * Math.PI;
  e = new THREE.Vector3();
  a = [];
  b = [];
  for (c = 0; c <= this.radialSegments; c++)
    for (d = 0; d <= this.tubularSegments; d++) {
      var f = (d / this.tubularSegments) * this.arc,
        g = ((2 * c) / this.radialSegments) * Math.PI;
      e.x = this.radius * Math.cos(f);
      e.y = this.radius * Math.sin(f);
      var h = new THREE.Vector3();
      h.x = (this.radius + this.tube * Math.cos(g)) * Math.cos(f);
      h.y = (this.radius + this.tube * Math.cos(g)) * Math.sin(f);
      h.z = this.tube * Math.sin(g);
      this.vertices.push(h);
      a.push(
        new THREE.Vector2(d / this.tubularSegments, c / this.radialSegments)
      );
      b.push(h.clone().sub(e).normalize());
    }
  for (c = 1; c <= this.radialSegments; c++)
    for (d = 1; d <= this.tubularSegments; d++) {
      var e = (this.tubularSegments + 1) * c + d - 1,
        f = (this.tubularSegments + 1) * (c - 1) + d - 1,
        g = (this.tubularSegments + 1) * (c - 1) + d,
        h = (this.tubularSegments + 1) * c + d,
        i = new THREE.Face4(e, f, g, h, [b[e], b[f], b[g], b[h]]);
      i.normal.add(b[e]);
      i.normal.add(b[f]);
      i.normal.add(b[g]);
      i.normal.add(b[h]);
      i.normal.normalize();
      this.faces.push(i);
      this.faceVertexUvs[0].push([
        a[e].clone(),
        a[f].clone(),
        a[g].clone(),
        a[h].clone(),
      ]);
    }
  this.computeCentroids();
};
THREE.TorusGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.TorusKnotGeometry = function (a, b, c, d, e, f, g) {
  function h(a, b, c, d, e, f) {
    var g = Math.cos(a);
    Math.cos(b);
    b = Math.sin(a);
    a *= c / d;
    c = Math.cos(a);
    g *= 0.5 * e * (2 + c);
    b = 0.5 * e * (2 + c) * b;
    e = 0.5 * f * e * Math.sin(a);
    return new THREE.Vector3(g, b, e);
  }
  THREE.Geometry.call(this);
  this.radius = a || 100;
  this.tube = b || 40;
  this.radialSegments = c || 64;
  this.tubularSegments = d || 8;
  this.p = e || 2;
  this.q = f || 3;
  this.heightScale = g || 1;
  this.grid = Array(this.radialSegments);
  c = new THREE.Vector3();
  d = new THREE.Vector3();
  e = new THREE.Vector3();
  for (a = 0; a < this.radialSegments; ++a) {
    this.grid[a] = Array(this.tubularSegments);
    for (b = 0; b < this.tubularSegments; ++b) {
      var i = 2 * (a / this.radialSegments) * this.p * Math.PI,
        g = 2 * (b / this.tubularSegments) * Math.PI,
        f = h(i, g, this.q, this.p, this.radius, this.heightScale),
        i = h(i + 0.01, g, this.q, this.p, this.radius, this.heightScale);
      c.subVectors(i, f);
      d.addVectors(i, f);
      e.crossVectors(c, d);
      d.crossVectors(e, c);
      e.normalize();
      d.normalize();
      i = -this.tube * Math.cos(g);
      g = this.tube * Math.sin(g);
      f.x += i * d.x + g * e.x;
      f.y += i * d.y + g * e.y;
      f.z += i * d.z + g * e.z;
      this.grid[a][b] =
        this.vertices.push(new THREE.Vector3(f.x, f.y, f.z)) - 1;
    }
  }
  for (a = 0; a < this.radialSegments; ++a)
    for (b = 0; b < this.tubularSegments; ++b) {
      var e = (a + 1) % this.radialSegments,
        f = (b + 1) % this.tubularSegments,
        c = this.grid[a][b],
        d = this.grid[e][b],
        e = this.grid[e][f],
        f = this.grid[a][f],
        g = new THREE.Vector2(
          a / this.radialSegments,
          b / this.tubularSegments
        ),
        i = new THREE.Vector2(
          (a + 1) / this.radialSegments,
          b / this.tubularSegments
        ),
        j = new THREE.Vector2(
          (a + 1) / this.radialSegments,
          (b + 1) / this.tubularSegments
        ),
        m = new THREE.Vector2(
          a / this.radialSegments,
          (b + 1) / this.tubularSegments
        );
      this.faces.push(new THREE.Face4(c, d, e, f));
      this.faceVertexUvs[0].push([g, i, j, m]);
    }
  this.computeCentroids();
  this.computeFaceNormals();
  this.computeVertexNormals();
};
THREE.TorusKnotGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.TubeGeometry = function (a, b, c, d, e, f) {
  THREE.Geometry.call(this);
  this.path = a;
  this.segments = b || 64;
  this.radius = c || 1;
  this.radiusSegments = d || 8;
  this.closed = e || !1;
  f && (this.debug = new THREE.Object3D());
  this.grid = [];
  var g,
    h,
    e = this.segments + 1,
    i,
    j,
    m,
    f = new THREE.Vector3(),
    p,
    l,
    r,
    b = new THREE.TubeGeometry.FrenetFrames(
      this.path,
      this.segments,
      this.closed
    );
  p = b.tangents;
  l = b.normals;
  r = b.binormals;
  this.tangents = p;
  this.normals = l;
  this.binormals = r;
  for (b = 0; b < e; b++) {
    this.grid[b] = [];
    d = b / (e - 1);
    m = a.getPointAt(d);
    d = p[b];
    g = l[b];
    h = r[b];
    this.debug &&
      (this.debug.add(new THREE.ArrowHelper(d, m, c, 255)),
      this.debug.add(new THREE.ArrowHelper(g, m, c, 16711680)),
      this.debug.add(new THREE.ArrowHelper(h, m, c, 65280)));
    for (d = 0; d < this.radiusSegments; d++)
      (i = 2 * (d / this.radiusSegments) * Math.PI),
        (j = -this.radius * Math.cos(i)),
        (i = this.radius * Math.sin(i)),
        f.copy(m),
        (f.x += j * g.x + i * h.x),
        (f.y += j * g.y + i * h.y),
        (f.z += j * g.z + i * h.z),
        (this.grid[b][d] =
          this.vertices.push(new THREE.Vector3(f.x, f.y, f.z)) - 1);
  }
  for (b = 0; b < this.segments; b++)
    for (d = 0; d < this.radiusSegments; d++)
      (e = this.closed ? (b + 1) % this.segments : b + 1),
        (f = (d + 1) % this.radiusSegments),
        (a = this.grid[b][d]),
        (c = this.grid[e][d]),
        (e = this.grid[e][f]),
        (f = this.grid[b][f]),
        (p = new THREE.Vector2(b / this.segments, d / this.radiusSegments)),
        (l = new THREE.Vector2(
          (b + 1) / this.segments,
          d / this.radiusSegments
        )),
        (r = new THREE.Vector2(
          (b + 1) / this.segments,
          (d + 1) / this.radiusSegments
        )),
        (g = new THREE.Vector2(
          b / this.segments,
          (d + 1) / this.radiusSegments
        )),
        this.faces.push(new THREE.Face4(a, c, e, f)),
        this.faceVertexUvs[0].push([p, l, r, g]);
  this.computeCentroids();
  this.computeFaceNormals();
  this.computeVertexNormals();
};
THREE.TubeGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.TubeGeometry.FrenetFrames = function (a, b, c) {
  new THREE.Vector3();
  var d = new THREE.Vector3();
  new THREE.Vector3();
  var e = [],
    f = [],
    g = [],
    h = new THREE.Vector3(),
    i = new THREE.Matrix4(),
    b = b + 1,
    j,
    m,
    p;
  this.tangents = e;
  this.normals = f;
  this.binormals = g;
  for (j = 0; j < b; j++)
    (m = j / (b - 1)), (e[j] = a.getTangentAt(m)), e[j].normalize();
  f[0] = new THREE.Vector3();
  g[0] = new THREE.Vector3();
  a = Number.MAX_VALUE;
  j = Math.abs(e[0].x);
  m = Math.abs(e[0].y);
  p = Math.abs(e[0].z);
  j <= a && ((a = j), d.set(1, 0, 0));
  m <= a && ((a = m), d.set(0, 1, 0));
  p <= a && d.set(0, 0, 1);
  h.crossVectors(e[0], d).normalize();
  f[0].crossVectors(e[0], h);
  g[0].crossVectors(e[0], f[0]);
  for (j = 1; j < b; j++)
    (f[j] = f[j - 1].clone()),
      (g[j] = g[j - 1].clone()),
      h.crossVectors(e[j - 1], e[j]),
      1e-4 < h.length() &&
        (h.normalize(),
        (d = Math.acos(e[j - 1].dot(e[j]))),
        f[j].applyMatrix4(i.makeRotationAxis(h, d))),
      g[j].crossVectors(e[j], f[j]);
  if (c) {
    d = Math.acos(f[0].dot(f[b - 1]));
    d /= b - 1;
    0 < e[0].dot(h.crossVectors(f[0], f[b - 1])) && (d = -d);
    for (j = 1; j < b; j++)
      f[j].applyMatrix4(i.makeRotationAxis(e[j], d * j)),
        g[j].crossVectors(e[j], f[j]);
  }
};
THREE.PolyhedronGeometry = function (a, b, c, d) {
  function e(a) {
    var b = a.normalize().clone();
    b.index = h.vertices.push(b) - 1;
    var c = Math.atan2(a.z, -a.x) / 2 / Math.PI + 0.5,
      a = Math.atan2(-a.y, Math.sqrt(a.x * a.x + a.z * a.z)) / Math.PI + 0.5;
    b.uv = new THREE.Vector2(c, 1 - a);
    return b;
  }
  function f(a, b, c) {
    var d = new THREE.Face3(a.index, b.index, c.index, [
      a.clone(),
      b.clone(),
      c.clone(),
    ]);
    d.centroid.add(a).add(b).add(c).divideScalar(3);
    d.normal.copy(d.centroid).normalize();
    h.faces.push(d);
    d = Math.atan2(d.centroid.z, -d.centroid.x);
    h.faceVertexUvs[0].push([g(a.uv, a, d), g(b.uv, b, d), g(c.uv, c, d)]);
  }
  function g(a, b, c) {
    0 > c && 1 === a.x && (a = new THREE.Vector2(a.x - 1, a.y));
    0 === b.x &&
      0 === b.z &&
      (a = new THREE.Vector2(c / 2 / Math.PI + 0.5, a.y));
    return a.clone();
  }
  THREE.Geometry.call(this);
  for (var c = c || 1, d = d || 0, h = this, i = 0, j = a.length; i < j; i++)
    e(new THREE.Vector3(a[i][0], a[i][1], a[i][2]));
  for (var m = this.vertices, a = [], i = 0, j = b.length; i < j; i++) {
    var p = m[b[i][0]],
      l = m[b[i][1]],
      r = m[b[i][2]];
    a[i] = new THREE.Face3(p.index, l.index, r.index, [
      p.clone(),
      l.clone(),
      r.clone(),
    ]);
  }
  i = 0;
  for (j = a.length; i < j; i++) {
    l = a[i];
    m = d;
    b = Math.pow(2, m);
    Math.pow(4, m);
    for (
      var m = e(h.vertices[l.a]),
        p = e(h.vertices[l.b]),
        s = e(h.vertices[l.c]),
        l = [],
        r = 0;
      r <= b;
      r++
    ) {
      l[r] = [];
      for (
        var n = e(m.clone().lerp(s, r / b)),
          q = e(p.clone().lerp(s, r / b)),
          y = b - r,
          u = 0;
        u <= y;
        u++
      )
        l[r][u] = 0 == u && r == b ? n : e(n.clone().lerp(q, u / y));
    }
    for (r = 0; r < b; r++)
      for (u = 0; u < 2 * (b - r) - 1; u++)
        (m = Math.floor(u / 2)),
          0 == u % 2
            ? f(l[r][m + 1], l[r + 1][m], l[r][m])
            : f(l[r][m + 1], l[r + 1][m + 1], l[r + 1][m]);
  }
  i = 0;
  for (j = this.faceVertexUvs[0].length; i < j; i++)
    (d = this.faceVertexUvs[0][i]),
      (a = d[0].x),
      (b = d[1].x),
      (m = d[2].x),
      (p = Math.max(a, Math.max(b, m))),
      (l = Math.min(a, Math.min(b, m))),
      0.9 < p &&
        0.1 > l &&
        (0.2 > a && (d[0].x += 1),
        0.2 > b && (d[1].x += 1),
        0.2 > m && (d[2].x += 1));
  this.mergeVertices();
  i = 0;
  for (j = this.vertices.length; i < j; i++) this.vertices[i].multiplyScalar(c);
  this.computeCentroids();
  this.boundingSphere = new THREE.Sphere(new THREE.Vector3(), c);
};
THREE.PolyhedronGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.IcosahedronGeometry = function (a, b) {
  this.radius = a;
  this.detail = b;
  var c = (1 + Math.sqrt(5)) / 2;
  THREE.PolyhedronGeometry.call(
    this,
    [
      [-1, c, 0],
      [1, c, 0],
      [-1, -c, 0],
      [1, -c, 0],
      [0, -1, c],
      [0, 1, c],
      [0, -1, -c],
      [0, 1, -c],
      [c, 0, -1],
      [c, 0, 1],
      [-c, 0, -1],
      [-c, 0, 1],
    ],
    [
      [0, 11, 5],
      [0, 5, 1],
      [0, 1, 7],
      [0, 7, 10],
      [0, 10, 11],
      [1, 5, 9],
      [5, 11, 4],
      [11, 10, 2],
      [10, 7, 6],
      [7, 1, 8],
      [3, 9, 4],
      [3, 4, 2],
      [3, 2, 6],
      [3, 6, 8],
      [3, 8, 9],
      [4, 9, 5],
      [2, 4, 11],
      [6, 2, 10],
      [8, 6, 7],
      [9, 8, 1],
    ],
    a,
    b
  );
};
THREE.IcosahedronGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.OctahedronGeometry = function (a, b) {
  THREE.PolyhedronGeometry.call(
    this,
    [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ],
    [
      [0, 2, 4],
      [0, 4, 3],
      [0, 3, 5],
      [0, 5, 2],
      [1, 2, 5],
      [1, 5, 3],
      [1, 3, 4],
      [1, 4, 2],
    ],
    a,
    b
  );
};
THREE.OctahedronGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.TetrahedronGeometry = function (a, b) {
  THREE.PolyhedronGeometry.call(
    this,
    [
      [1, 1, 1],
      [-1, -1, 1],
      [-1, 1, -1],
      [1, -1, -1],
    ],
    [
      [2, 1, 0],
      [0, 3, 2],
      [1, 3, 0],
      [2, 3, 1],
    ],
    a,
    b
  );
};
THREE.TetrahedronGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.ParametricGeometry = function (a, b, c, d) {
  THREE.Geometry.call(this);
  var e = this.vertices,
    f = this.faces,
    g = this.faceVertexUvs[0],
    d = void 0 === d ? !1 : d,
    h,
    i,
    j,
    m,
    p = b + 1;
  for (h = 0; h <= c; h++) {
    m = h / c;
    for (i = 0; i <= b; i++) (j = i / b), (j = a(j, m)), e.push(j);
  }
  var l, r, s, n;
  for (h = 0; h < c; h++)
    for (i = 0; i < b; i++)
      (a = h * p + i),
        (e = h * p + i + 1),
        (m = (h + 1) * p + i),
        (j = (h + 1) * p + i + 1),
        (l = new THREE.Vector2(i / b, h / c)),
        (r = new THREE.Vector2((i + 1) / b, h / c)),
        (s = new THREE.Vector2(i / b, (h + 1) / c)),
        (n = new THREE.Vector2((i + 1) / b, (h + 1) / c)),
        d
          ? (f.push(new THREE.Face3(a, e, m)),
            f.push(new THREE.Face3(e, j, m)),
            g.push([l, r, s]),
            g.push([r, n, s]))
          : (f.push(new THREE.Face4(a, e, j, m)), g.push([l, r, n, s]));
  this.computeCentroids();
  this.computeFaceNormals();
  this.computeVertexNormals();
};
THREE.ParametricGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.ConvexGeometry = function (a) {
  function b(a) {
    var b = a.length();
    return new THREE.Vector2(a.x / b, a.y / b);
  }
  THREE.Geometry.call(this);
  for (
    var c = [
        [0, 1, 2],
        [0, 2, 1],
      ],
      d = 3;
    d < a.length;
    d++
  ) {
    var e = d,
      f = a[e].clone(),
      g = f.length();
    f.x += g * 2e-6 * (Math.random() - 0.5);
    f.y += g * 2e-6 * (Math.random() - 0.5);
    f.z += g * 2e-6 * (Math.random() - 0.5);
    for (var g = [], h = 0; h < c.length; ) {
      var i = c[h],
        j = f,
        m = a[i[0]],
        p;
      p = m;
      var l = a[i[1]],
        r = a[i[2]],
        s = new THREE.Vector3(),
        n = new THREE.Vector3();
      s.subVectors(r, l);
      n.subVectors(p, l);
      s.cross(n);
      s.normalize();
      p = s;
      m = p.dot(m);
      if (p.dot(j) >= m) {
        for (j = 0; 3 > j; j++) {
          m = [i[j], i[(j + 1) % 3]];
          p = !0;
          for (l = 0; l < g.length; l++)
            if (g[l][0] === m[1] && g[l][1] === m[0]) {
              g[l] = g[g.length - 1];
              g.pop();
              p = !1;
              break;
            }
          p && g.push(m);
        }
        c[h] = c[c.length - 1];
        c.pop();
      } else h++;
    }
    for (l = 0; l < g.length; l++) c.push([g[l][0], g[l][1], e]);
  }
  e = 0;
  f = Array(a.length);
  for (d = 0; d < c.length; d++) {
    g = c[d];
    for (h = 0; 3 > h; h++)
      void 0 === f[g[h]] && ((f[g[h]] = e++), this.vertices.push(a[g[h]])),
        (g[h] = f[g[h]]);
  }
  for (d = 0; d < c.length; d++)
    this.faces.push(new THREE.Face3(c[d][0], c[d][1], c[d][2]));
  for (d = 0; d < this.faces.length; d++)
    (g = this.faces[d]),
      this.faceVertexUvs[0].push([
        b(this.vertices[g.a]),
        b(this.vertices[g.b]),
        b(this.vertices[g.c]),
      ]);
  this.computeCentroids();
  this.computeFaceNormals();
  this.computeVertexNormals();
};
THREE.ConvexGeometry.prototype = Object.create(THREE.Geometry.prototype);
THREE.AxisHelper = function (a) {
  var a = a || 1,
    b = new THREE.Geometry();
  b.vertices.push(
    new THREE.Vector3(),
    new THREE.Vector3(a, 0, 0),
    new THREE.Vector3(),
    new THREE.Vector3(0, a, 0),
    new THREE.Vector3(),
    new THREE.Vector3(0, 0, a)
  );
  b.colors.push(
    new THREE.Color(16711680),
    new THREE.Color(16755200),
    new THREE.Color(65280),
    new THREE.Color(11206400),
    new THREE.Color(255),
    new THREE.Color(43775)
  );
  a = new THREE.LineBasicMaterial({ vertexColors: THREE.VertexColors });
  THREE.Line.call(this, b, a, THREE.LinePieces);
};
THREE.AxisHelper.prototype = Object.create(THREE.Line.prototype);
THREE.ArrowHelper = function (a, b, c, d) {
  THREE.Object3D.call(this);
  void 0 === d && (d = 16776960);
  void 0 === c && (c = 1);
  this.position = b;
  this.useQuaternion = !0;
  b = new THREE.Geometry();
  b.vertices.push(new THREE.Vector3(0, 0, 0));
  b.vertices.push(new THREE.Vector3(0, 1, 0));
  this.line = new THREE.Line(b, new THREE.LineBasicMaterial({ color: d }));
  this.line.matrixAutoUpdate = !1;
  this.add(this.line);
  b = new THREE.CylinderGeometry(0, 0.05, 0.25, 5, 1);
  b.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.875, 0));
  this.cone = new THREE.Mesh(b, new THREE.MeshBasicMaterial({ color: d }));
  this.cone.matrixAutoUpdate = !1;
  this.add(this.cone);
  this.setDirection(a);
  this.setLength(c);
};
THREE.ArrowHelper.prototype = Object.create(THREE.Object3D.prototype);
THREE.ArrowHelper.prototype.setDirection = (function () {
  var a = new THREE.Vector3(),
    b;
  return function (c) {
    0.999 < c.y
      ? this.quaternion.set(0, 0, 0, 1)
      : -0.999 > c.y
      ? this.quaternion.set(1, 0, 0, 0)
      : (a.set(c.z, 0, -c.x).normalize(),
        (b = Math.acos(c.y)),
        this.quaternion.setFromAxisAngle(a, b));
  };
})();
THREE.ArrowHelper.prototype.setLength = function (a) {
  this.scale.set(a, a, a);
};
THREE.ArrowHelper.prototype.setColor = function (a) {
  this.line.material.color.setHex(a);
  this.cone.material.color.setHex(a);
};
THREE.BoxHelper = function (a) {
  var a = a || 1,
    b = new THREE.Geometry(),
    a = [
      new THREE.Vector3(a, a, a),
      new THREE.Vector3(-a, a, a),
      new THREE.Vector3(-a, -a, a),
      new THREE.Vector3(a, -a, a),
      new THREE.Vector3(a, a, -a),
      new THREE.Vector3(-a, a, -a),
      new THREE.Vector3(-a, -a, -a),
      new THREE.Vector3(a, -a, -a),
    ];
  b.vertices.push(
    a[0],
    a[1],
    a[1],
    a[2],
    a[2],
    a[3],
    a[3],
    a[0],
    a[4],
    a[5],
    a[5],
    a[6],
    a[6],
    a[7],
    a[7],
    a[4],
    a[0],
    a[4],
    a[1],
    a[5],
    a[2],
    a[6],
    a[3],
    a[7]
  );
  this.vertices = a;
  THREE.Line.call(this, b, new THREE.LineBasicMaterial(), THREE.LinePieces);
};
THREE.BoxHelper.prototype = Object.create(THREE.Line.prototype);
THREE.BoxHelper.prototype.update = function (a) {
  var b = a.geometry;
  null === b.boundingBox && b.computeBoundingBox();
  var c = b.boundingBox.min,
    b = b.boundingBox.max,
    d = this.vertices;
  d[0].set(b.x, b.y, b.z);
  d[1].set(c.x, b.y, b.z);
  d[2].set(c.x, c.y, b.z);
  d[3].set(b.x, c.y, b.z);
  d[4].set(b.x, b.y, c.z);
  d[5].set(c.x, b.y, c.z);
  d[6].set(c.x, c.y, c.z);
  d[7].set(b.x, c.y, c.z);
  this.geometry.computeBoundingSphere();
  this.geometry.verticesNeedUpdate = !0;
  this.matrixAutoUpdate = !1;
  this.matrixWorld = a.matrixWorld;
};
THREE.CameraHelper = function (a) {
  function b(a, b, d) {
    c(a, d);
    c(b, d);
  }
  function c(a, b) {
    d.vertices.push(new THREE.Vector3());
    d.colors.push(new THREE.Color(b));
    void 0 === f[a] && (f[a] = []);
    f[a].push(d.vertices.length - 1);
  }
  THREE.Line.call(this);
  var d = new THREE.Geometry(),
    e = new THREE.LineBasicMaterial({
      color: 16777215,
      vertexColors: THREE.FaceColors,
    }),
    f = {};
  b("n1", "n2", 16755200);
  b("n2", "n4", 16755200);
  b("n4", "n3", 16755200);
  b("n3", "n1", 16755200);
  b("f1", "f2", 16755200);
  b("f2", "f4", 16755200);
  b("f4", "f3", 16755200);
  b("f3", "f1", 16755200);
  b("n1", "f1", 16755200);
  b("n2", "f2", 16755200);
  b("n3", "f3", 16755200);
  b("n4", "f4", 16755200);
  b("p", "n1", 16711680);
  b("p", "n2", 16711680);
  b("p", "n3", 16711680);
  b("p", "n4", 16711680);
  b("u1", "u2", 43775);
  b("u2", "u3", 43775);
  b("u3", "u1", 43775);
  b("c", "t", 16777215);
  b("p", "c", 3355443);
  b("cn1", "cn2", 3355443);
  b("cn3", "cn4", 3355443);
  b("cf1", "cf2", 3355443);
  b("cf3", "cf4", 3355443);
  THREE.Line.call(this, d, e, THREE.LinePieces);
  this.camera = a;
  this.matrixWorld = a.matrixWorld;
  this.matrixAutoUpdate = !1;
  this.pointMap = f;
  this.update();
};
THREE.CameraHelper.prototype = Object.create(THREE.Line.prototype);
THREE.CameraHelper.prototype.update = (function () {
  var a = new THREE.Vector3(),
    b = new THREE.Camera(),
    c = new THREE.Projector();
  return function () {
    function d(d, g, h, i) {
      a.set(g, h, i);
      c.unprojectVector(a, b);
      d = e.pointMap[d];
      if (void 0 !== d) {
        g = 0;
        for (h = d.length; g < h; g++) e.geometry.vertices[d[g]].copy(a);
      }
    }
    var e = this;
    b.projectionMatrix.copy(this.camera.projectionMatrix);
    d("c", 0, 0, -1);
    d("t", 0, 0, 1);
    d("n1", -1, -1, -1);
    d("n2", 1, -1, -1);
    d("n3", -1, 1, -1);
    d("n4", 1, 1, -1);
    d("f1", -1, -1, 1);
    d("f2", 1, -1, 1);
    d("f3", -1, 1, 1);
    d("f4", 1, 1, 1);
    d("u1", 0.7, 1.1, -1);
    d("u2", -0.7, 1.1, -1);
    d("u3", 0, 2, -1);
    d("cf1", -1, 0, 1);
    d("cf2", 1, 0, 1);
    d("cf3", 0, -1, 1);
    d("cf4", 0, 1, 1);
    d("cn1", -1, 0, -1);
    d("cn2", 1, 0, -1);
    d("cn3", 0, -1, -1);
    d("cn4", 0, 1, -1);
    this.geometry.verticesNeedUpdate = !0;
  };
})();
THREE.DirectionalLightHelper = function (a, b) {
  THREE.Object3D.call(this);
  this.matrixAutoUpdate = !1;
  this.light = a;
  var c = new THREE.SphereGeometry(b, 4, 2),
    d = new THREE.MeshBasicMaterial({ fog: !1, wireframe: !0 });
  d.color.copy(this.light.color).multiplyScalar(this.light.intensity);
  this.lightSphere = new THREE.Mesh(c, d);
  this.lightSphere.matrixWorld = this.light.matrixWorld;
  this.lightSphere.matrixAutoUpdate = !1;
  this.add(this.lightSphere);
  c = new THREE.Geometry();
  c.vertices.push(this.light.position);
  c.vertices.push(this.light.target.position);
  c.computeLineDistances();
  d = new THREE.LineDashedMaterial({
    dashSize: 4,
    gapSize: 4,
    opacity: 0.75,
    transparent: !0,
    fog: !1,
  });
  d.color.copy(this.light.color).multiplyScalar(this.light.intensity);
  this.targetLine = new THREE.Line(c, d);
  this.add(this.targetLine);
};
THREE.DirectionalLightHelper.prototype = Object.create(
  THREE.Object3D.prototype
);
THREE.DirectionalLightHelper.prototype.update = function () {
  this.lightSphere.material.color
    .copy(this.light.color)
    .multiplyScalar(this.light.intensity);
  this.targetLine.geometry.computeLineDistances();
  this.targetLine.geometry.verticesNeedUpdate = !0;
  this.targetLine.material.color
    .copy(this.light.color)
    .multiplyScalar(this.light.intensity);
};
THREE.GridHelper = function (a, b) {
  for (
    var c = new THREE.Geometry(),
      d = new THREE.LineBasicMaterial({ vertexColors: THREE.VertexColors }),
      e = new THREE.Color(4473924),
      f = new THREE.Color(8947848),
      g = -a;
    g <= a;
    g += b
  ) {
    c.vertices.push(new THREE.Vector3(-a, 0, g));
    c.vertices.push(new THREE.Vector3(a, 0, g));
    c.vertices.push(new THREE.Vector3(g, 0, -a));
    c.vertices.push(new THREE.Vector3(g, 0, a));
    var h = 0 === g ? e : f;
    c.colors.push(h, h, h, h);
  }
  THREE.Line.call(this, c, d, THREE.LinePieces);
};
THREE.GridHelper.prototype = Object.create(THREE.Line.prototype);
THREE.HemisphereLightHelper = function (a, b) {
  THREE.Object3D.call(this);
  this.light = a;
  var c = new THREE.SphereGeometry(b, 4, 2);
  c.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  for (var d = 0; 8 > d; d++) c.faces[d].materialIndex = 4 > d ? 0 : 1;
  d = new THREE.MeshBasicMaterial({ fog: !1, wireframe: !0 });
  d.color.copy(a.color).multiplyScalar(a.intensity);
  var e = new THREE.MeshBasicMaterial({ fog: !1, wireframe: !0 });
  e.color.copy(a.groundColor).multiplyScalar(a.intensity);
  this.lightSphere = new THREE.Mesh(c, new THREE.MeshFaceMaterial([d, e]));
  this.lightSphere.position = a.position;
  this.lightSphere.lookAt(new THREE.Vector3());
  this.add(this.lightSphere);
};
THREE.HemisphereLightHelper.prototype = Object.create(THREE.Object3D.prototype);
THREE.HemisphereLightHelper.prototype.update = function () {
  this.lightSphere.lookAt(new THREE.Vector3());
  this.lightSphere.material.materials[0].color
    .copy(this.light.color)
    .multiplyScalar(this.light.intensity);
  this.lightSphere.material.materials[1].color
    .copy(this.light.groundColor)
    .multiplyScalar(this.light.intensity);
};
THREE.PointLightHelper = function (a, b) {
  THREE.Object3D.call(this);
  this.matrixAutoUpdate = !1;
  this.light = a;
  var c = new THREE.SphereGeometry(b, 4, 2),
    d = new THREE.MeshBasicMaterial({ fog: !1, wireframe: !0 });
  d.color.copy(this.light.color).multiplyScalar(this.light.intensity);
  this.lightSphere = new THREE.Mesh(c, d);
  this.lightSphere.matrixWorld = this.light.matrixWorld;
  this.lightSphere.matrixAutoUpdate = !1;
  this.add(this.lightSphere);
};
THREE.PointLightHelper.prototype = Object.create(THREE.Object3D.prototype);
THREE.PointLightHelper.prototype.update = function () {
  this.lightSphere.material.color
    .copy(this.light.color)
    .multiplyScalar(this.light.intensity);
};
THREE.SpotLightHelper = function (a, b) {
  THREE.Object3D.call(this);
  this.matrixAutoUpdate = !1;
  this.light = a;
  var c = new THREE.SphereGeometry(b, 4, 2),
    d = new THREE.MeshBasicMaterial({ fog: !1, wireframe: !0 });
  d.color.copy(this.light.color).multiplyScalar(this.light.intensity);
  this.lightSphere = new THREE.Mesh(c, d);
  this.lightSphere.matrixWorld = this.light.matrixWorld;
  this.lightSphere.matrixAutoUpdate = !1;
  this.add(this.lightSphere);
  c = new THREE.CylinderGeometry(1e-4, 1, 1, 8, 1, !0);
  c.applyMatrix(new THREE.Matrix4().makeTranslation(0, -0.5, 0));
  c.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  d = new THREE.MeshBasicMaterial({
    fog: !1,
    wireframe: !0,
    opacity: 0.3,
    transparent: !0,
  });
  d.color.copy(this.light.color).multiplyScalar(this.light.intensity);
  this.lightCone = new THREE.Mesh(c, d);
  this.lightCone.position = this.light.position;
  c = a.distance ? a.distance : 1e4;
  d = c * Math.tan(a.angle);
  this.lightCone.scale.set(d, d, c);
  this.lightCone.lookAt(this.light.target.position);
  this.add(this.lightCone);
};
THREE.SpotLightHelper.prototype = Object.create(THREE.Object3D.prototype);
THREE.SpotLightHelper.prototype.update = function () {
  var a = this.light.distance ? this.light.distance : 1e4,
    b = a * Math.tan(this.light.angle);
  this.lightCone.scale.set(b, b, a);
  this.lightCone.lookAt(this.light.target.position);
  this.lightSphere.material.color
    .copy(this.light.color)
    .multiplyScalar(this.light.intensity);
  this.lightCone.material.color
    .copy(this.light.color)
    .multiplyScalar(this.light.intensity);
};
THREE.ImmediateRenderObject = function () {
  THREE.Object3D.call(this);
  this.render = function () {};
};
THREE.ImmediateRenderObject.prototype = Object.create(THREE.Object3D.prototype);
THREE.LensFlare = function (a, b, c, d, e) {
  THREE.Object3D.call(this);
  this.lensFlares = [];
  this.positionScreen = new THREE.Vector3();
  this.customUpdateCallback = void 0;
  void 0 !== a && this.add(a, b, c, d, e);
};
THREE.LensFlare.prototype = Object.create(THREE.Object3D.prototype);
THREE.LensFlare.prototype.add = function (a, b, c, d, e, f) {
  void 0 === b && (b = -1);
  void 0 === c && (c = 0);
  void 0 === f && (f = 1);
  void 0 === e && (e = new THREE.Color(16777215));
  void 0 === d && (d = THREE.NormalBlending);
  c = Math.min(c, Math.max(0, c));
  this.lensFlares.push({
    texture: a,
    size: b,
    distance: c,
    x: 0,
    y: 0,
    z: 0,
    scale: 1,
    rotation: 1,
    opacity: f,
    color: e,
    blending: d,
  });
};
THREE.LensFlare.prototype.updateLensFlares = function () {
  var a,
    b = this.lensFlares.length,
    c,
    d = 2 * -this.positionScreen.x,
    e = 2 * -this.positionScreen.y;
  for (a = 0; a < b; a++)
    (c = this.lensFlares[a]),
      (c.x = this.positionScreen.x + d * c.distance),
      (c.y = this.positionScreen.y + e * c.distance),
      (c.wantedRotation = 0.25 * c.x * Math.PI),
      (c.rotation += 0.25 * (c.wantedRotation - c.rotation));
};
THREE.MorphBlendMesh = function (a, b) {
  THREE.Mesh.call(this, a, b);
  this.animationsMap = {};
  this.animationsList = [];
  var c = this.geometry.morphTargets.length;
  this.createAnimation("__default", 0, c - 1, c / 1);
  this.setAnimationWeight("__default", 1);
};
THREE.MorphBlendMesh.prototype = Object.create(THREE.Mesh.prototype);
THREE.MorphBlendMesh.prototype.createAnimation = function (a, b, c, d) {
  b = {
    startFrame: b,
    endFrame: c,
    length: c - b + 1,
    fps: d,
    duration: (c - b) / d,
    lastFrame: 0,
    currentFrame: 0,
    active: !1,
    time: 0,
    direction: 1,
    weight: 1,
    directionBackwards: !1,
    mirroredLoop: !1,
  };
  this.animationsMap[a] = b;
  this.animationsList.push(b);
};
THREE.MorphBlendMesh.prototype.autoCreateAnimations = function (a) {
  for (
    var b = /([a-z]+)(\d+)/,
      c,
      d = {},
      e = this.geometry,
      f = 0,
      g = e.morphTargets.length;
    f < g;
    f++
  ) {
    var h = e.morphTargets[f].name.match(b);
    if (h && 1 < h.length) {
      var i = h[1];
      d[i] || (d[i] = { start: Infinity, end: -Infinity });
      h = d[i];
      f < h.start && (h.start = f);
      f > h.end && (h.end = f);
      c || (c = i);
    }
  }
  for (i in d) (h = d[i]), this.createAnimation(i, h.start, h.end, a);
  this.firstAnimation = c;
};
THREE.MorphBlendMesh.prototype.setAnimationDirectionForward = function (a) {
  if ((a = this.animationsMap[a]))
    (a.direction = 1), (a.directionBackwards = !1);
};
THREE.MorphBlendMesh.prototype.setAnimationDirectionBackward = function (a) {
  if ((a = this.animationsMap[a]))
    (a.direction = -1), (a.directionBackwards = !0);
};
THREE.MorphBlendMesh.prototype.setAnimationFPS = function (a, b) {
  var c = this.animationsMap[a];
  c && ((c.fps = b), (c.duration = (c.end - c.start) / c.fps));
};
THREE.MorphBlendMesh.prototype.setAnimationDuration = function (a, b) {
  var c = this.animationsMap[a];
  c && ((c.duration = b), (c.fps = (c.end - c.start) / c.duration));
};
THREE.MorphBlendMesh.prototype.setAnimationWeight = function (a, b) {
  var c = this.animationsMap[a];
  c && (c.weight = b);
};
THREE.MorphBlendMesh.prototype.setAnimationTime = function (a, b) {
  var c = this.animationsMap[a];
  c && (c.time = b);
};
THREE.MorphBlendMesh.prototype.getAnimationTime = function (a) {
  var b = 0;
  if ((a = this.animationsMap[a])) b = a.time;
  return b;
};
THREE.MorphBlendMesh.prototype.getAnimationDuration = function (a) {
  var b = -1;
  if ((a = this.animationsMap[a])) b = a.duration;
  return b;
};
THREE.MorphBlendMesh.prototype.playAnimation = function (a) {
  var b = this.animationsMap[a];
  b
    ? ((b.time = 0), (b.active = !0))
    : console.warn("animation[" + a + "] undefined");
};
THREE.MorphBlendMesh.prototype.stopAnimation = function (a) {
  if ((a = this.animationsMap[a])) a.active = !1;
};
THREE.MorphBlendMesh.prototype.update = function (a) {
  for (var b = 0, c = this.animationsList.length; b < c; b++) {
    var d = this.animationsList[b];
    if (d.active) {
      var e = d.duration / d.length;
      d.time += d.direction * a;
      if (d.mirroredLoop) {
        if (d.time > d.duration || 0 > d.time)
          (d.direction *= -1),
            d.time > d.duration &&
              ((d.time = d.duration), (d.directionBackwards = !0)),
            0 > d.time && ((d.time = 0), (d.directionBackwards = !1));
      } else (d.time %= d.duration), 0 > d.time && (d.time += d.duration);
      var f =
          d.startFrame +
          THREE.Math.clamp(Math.floor(d.time / e), 0, d.length - 1),
        g = d.weight;
      f !== d.currentFrame &&
        ((this.morphTargetInfluences[d.lastFrame] = 0),
        (this.morphTargetInfluences[d.currentFrame] = 1 * g),
        (this.morphTargetInfluences[f] = 0),
        (d.lastFrame = d.currentFrame),
        (d.currentFrame = f));
      e = (d.time % e) / e;
      d.directionBackwards && (e = 1 - e);
      this.morphTargetInfluences[d.currentFrame] = e * g;
      this.morphTargetInfluences[d.lastFrame] = (1 - e) * g;
    }
  }
};
THREE.LensFlarePlugin = function () {
  function a(a, c) {
    var d = b.createProgram(),
      e = b.createShader(b.FRAGMENT_SHADER),
      f = b.createShader(b.VERTEX_SHADER),
      g = "precision " + c + " float;\n";
    b.shaderSource(e, g + a.fragmentShader);
    b.shaderSource(f, g + a.vertexShader);
    b.compileShader(e);
    b.compileShader(f);
    b.attachShader(d, e);
    b.attachShader(d, f);
    b.linkProgram(d);
    return d;
  }
  var b, c, d, e, f, g, h, i, j, m, p, l, r;
  this.init = function (s) {
    b = s.context;
    c = s;
    d = s.getPrecision();
    e = new Float32Array(16);
    f = new Uint16Array(6);
    s = 0;
    e[s++] = -1;
    e[s++] = -1;
    e[s++] = 0;
    e[s++] = 0;
    e[s++] = 1;
    e[s++] = -1;
    e[s++] = 1;
    e[s++] = 0;
    e[s++] = 1;
    e[s++] = 1;
    e[s++] = 1;
    e[s++] = 1;
    e[s++] = -1;
    e[s++] = 1;
    e[s++] = 0;
    e[s++] = 1;
    s = 0;
    f[s++] = 0;
    f[s++] = 1;
    f[s++] = 2;
    f[s++] = 0;
    f[s++] = 2;
    f[s++] = 3;
    g = b.createBuffer();
    h = b.createBuffer();
    b.bindBuffer(b.ARRAY_BUFFER, g);
    b.bufferData(b.ARRAY_BUFFER, e, b.STATIC_DRAW);
    b.bindBuffer(b.ELEMENT_ARRAY_BUFFER, h);
    b.bufferData(b.ELEMENT_ARRAY_BUFFER, f, b.STATIC_DRAW);
    i = b.createTexture();
    j = b.createTexture();
    b.bindTexture(b.TEXTURE_2D, i);
    b.texImage2D(
      b.TEXTURE_2D,
      0,
      b.RGB,
      16,
      16,
      0,
      b.RGB,
      b.UNSIGNED_BYTE,
      null
    );
    b.texParameteri(b.TEXTURE_2D, b.TEXTURE_WRAP_S, b.CLAMP_TO_EDGE);
    b.texParameteri(b.TEXTURE_2D, b.TEXTURE_WRAP_T, b.CLAMP_TO_EDGE);
    b.texParameteri(b.TEXTURE_2D, b.TEXTURE_MAG_FILTER, b.NEAREST);
    b.texParameteri(b.TEXTURE_2D, b.TEXTURE_MIN_FILTER, b.NEAREST);
    b.bindTexture(b.TEXTURE_2D, j);
    b.texImage2D(
      b.TEXTURE_2D,
      0,
      b.RGBA,
      16,
      16,
      0,
      b.RGBA,
      b.UNSIGNED_BYTE,
      null
    );
    b.texParameteri(b.TEXTURE_2D, b.TEXTURE_WRAP_S, b.CLAMP_TO_EDGE);
    b.texParameteri(b.TEXTURE_2D, b.TEXTURE_WRAP_T, b.CLAMP_TO_EDGE);
    b.texParameteri(b.TEXTURE_2D, b.TEXTURE_MAG_FILTER, b.NEAREST);
    b.texParameteri(b.TEXTURE_2D, b.TEXTURE_MIN_FILTER, b.NEAREST);
    0 >= b.getParameter(b.MAX_VERTEX_TEXTURE_IMAGE_UNITS)
      ? ((m = !1), (p = a(THREE.ShaderFlares.lensFlare, d)))
      : ((m = !0), (p = a(THREE.ShaderFlares.lensFlareVertexTexture, d)));
    l = {};
    r = {};
    l.vertex = b.getAttribLocation(p, "position");
    l.uv = b.getAttribLocation(p, "uv");
    r.renderType = b.getUniformLocation(p, "renderType");
    r.map = b.getUniformLocation(p, "map");
    r.occlusionMap = b.getUniformLocation(p, "occlusionMap");
    r.opacity = b.getUniformLocation(p, "opacity");
    r.color = b.getUniformLocation(p, "color");
    r.scale = b.getUniformLocation(p, "scale");
    r.rotation = b.getUniformLocation(p, "rotation");
    r.screenPosition = b.getUniformLocation(p, "screenPosition");
  };
  this.render = function (a, d, e, f) {
    var a = a.__webglFlares,
      u = a.length;
    if (u) {
      var x = new THREE.Vector3(),
        t = f / e,
        E = 0.5 * e,
        J = 0.5 * f,
        F = 16 / f,
        z = new THREE.Vector2(F * t, F),
        H = new THREE.Vector3(1, 1, 0),
        K = new THREE.Vector2(1, 1),
        G = r,
        F = l;
      b.useProgram(p);
      b.enableVertexAttribArray(l.vertex);
      b.enableVertexAttribArray(l.uv);
      b.uniform1i(G.occlusionMap, 0);
      b.uniform1i(G.map, 1);
      b.bindBuffer(b.ARRAY_BUFFER, g);
      b.vertexAttribPointer(F.vertex, 2, b.FLOAT, !1, 16, 0);
      b.vertexAttribPointer(F.uv, 2, b.FLOAT, !1, 16, 8);
      b.bindBuffer(b.ELEMENT_ARRAY_BUFFER, h);
      b.disable(b.CULL_FACE);
      b.depthMask(!1);
      var L, B, V, C, I;
      for (L = 0; L < u; L++)
        if (
          ((F = 16 / f),
          z.set(F * t, F),
          (C = a[L]),
          x.set(
            C.matrixWorld.elements[12],
            C.matrixWorld.elements[13],
            C.matrixWorld.elements[14]
          ),
          x.applyMatrix4(d.matrixWorldInverse),
          x.applyProjection(d.projectionMatrix),
          H.copy(x),
          (K.x = H.x * E + E),
          (K.y = H.y * J + J),
          m || (0 < K.x && K.x < e && 0 < K.y && K.y < f))
        ) {
          b.activeTexture(b.TEXTURE1);
          b.bindTexture(b.TEXTURE_2D, i);
          b.copyTexImage2D(b.TEXTURE_2D, 0, b.RGB, K.x - 8, K.y - 8, 16, 16, 0);
          b.uniform1i(G.renderType, 0);
          b.uniform2f(G.scale, z.x, z.y);
          b.uniform3f(G.screenPosition, H.x, H.y, H.z);
          b.disable(b.BLEND);
          b.enable(b.DEPTH_TEST);
          b.drawElements(b.TRIANGLES, 6, b.UNSIGNED_SHORT, 0);
          b.activeTexture(b.TEXTURE0);
          b.bindTexture(b.TEXTURE_2D, j);
          b.copyTexImage2D(
            b.TEXTURE_2D,
            0,
            b.RGBA,
            K.x - 8,
            K.y - 8,
            16,
            16,
            0
          );
          b.uniform1i(G.renderType, 1);
          b.disable(b.DEPTH_TEST);
          b.activeTexture(b.TEXTURE1);
          b.bindTexture(b.TEXTURE_2D, i);
          b.drawElements(b.TRIANGLES, 6, b.UNSIGNED_SHORT, 0);
          C.positionScreen.copy(H);
          C.customUpdateCallback
            ? C.customUpdateCallback(C)
            : C.updateLensFlares();
          b.uniform1i(G.renderType, 2);
          b.enable(b.BLEND);
          B = 0;
          for (V = C.lensFlares.length; B < V; B++)
            (I = C.lensFlares[B]),
              0.001 < I.opacity &&
                0.001 < I.scale &&
                ((H.x = I.x),
                (H.y = I.y),
                (H.z = I.z),
                (F = (I.size * I.scale) / f),
                (z.x = F * t),
                (z.y = F),
                b.uniform3f(G.screenPosition, H.x, H.y, H.z),
                b.uniform2f(G.scale, z.x, z.y),
                b.uniform1f(G.rotation, I.rotation),
                b.uniform1f(G.opacity, I.opacity),
                b.uniform3f(G.color, I.color.r, I.color.g, I.color.b),
                c.setBlending(
                  I.blending,
                  I.blendEquation,
                  I.blendSrc,
                  I.blendDst
                ),
                c.setTexture(I.texture, 1),
                b.drawElements(b.TRIANGLES, 6, b.UNSIGNED_SHORT, 0));
        }
      b.enable(b.CULL_FACE);
      b.enable(b.DEPTH_TEST);
      b.depthMask(!0);
    }
  };
};
THREE.ShadowMapPlugin = function () {
  var a,
    b,
    c,
    d,
    e,
    f,
    g = new THREE.Frustum(),
    h = new THREE.Matrix4(),
    i = new THREE.Vector3(),
    j = new THREE.Vector3(),
    m = new THREE.Vector3();
  this.init = function (g) {
    a = g.context;
    b = g;
    var g = THREE.ShaderLib.depthRGBA,
      h = THREE.UniformsUtils.clone(g.uniforms);
    c = new THREE.ShaderMaterial({
      fragmentShader: g.fragmentShader,
      vertexShader: g.vertexShader,
      uniforms: h,
    });
    d = new THREE.ShaderMaterial({
      fragmentShader: g.fragmentShader,
      vertexShader: g.vertexShader,
      uniforms: h,
      morphTargets: !0,
    });
    e = new THREE.ShaderMaterial({
      fragmentShader: g.fragmentShader,
      vertexShader: g.vertexShader,
      uniforms: h,
      skinning: !0,
    });
    f = new THREE.ShaderMaterial({
      fragmentShader: g.fragmentShader,
      vertexShader: g.vertexShader,
      uniforms: h,
      morphTargets: !0,
      skinning: !0,
    });
    c._shadowPass = !0;
    d._shadowPass = !0;
    e._shadowPass = !0;
    f._shadowPass = !0;
  };
  this.render = function (a, c) {
    b.shadowMapEnabled && b.shadowMapAutoUpdate && this.update(a, c);
  };
  this.update = function (p, l) {
    var r,
      s,
      n,
      q,
      y,
      u,
      x,
      t,
      E,
      J = [];
    q = 0;
    a.clearColor(1, 1, 1, 1);
    a.disable(a.BLEND);
    a.enable(a.CULL_FACE);
    a.frontFace(a.CCW);
    b.shadowMapCullFace === THREE.CullFaceFront
      ? a.cullFace(a.FRONT)
      : a.cullFace(a.BACK);
    b.setDepthTest(!0);
    r = 0;
    for (s = p.__lights.length; r < s; r++)
      if (((n = p.__lights[r]), n.castShadow))
        if (n instanceof THREE.DirectionalLight && n.shadowCascade)
          for (y = 0; y < n.shadowCascadeCount; y++) {
            var F;
            if (n.shadowCascadeArray[y]) F = n.shadowCascadeArray[y];
            else {
              E = n;
              x = y;
              F = new THREE.DirectionalLight();
              F.isVirtual = !0;
              F.onlyShadow = !0;
              F.castShadow = !0;
              F.shadowCameraNear = E.shadowCameraNear;
              F.shadowCameraFar = E.shadowCameraFar;
              F.shadowCameraLeft = E.shadowCameraLeft;
              F.shadowCameraRight = E.shadowCameraRight;
              F.shadowCameraBottom = E.shadowCameraBottom;
              F.shadowCameraTop = E.shadowCameraTop;
              F.shadowCameraVisible = E.shadowCameraVisible;
              F.shadowDarkness = E.shadowDarkness;
              F.shadowBias = E.shadowCascadeBias[x];
              F.shadowMapWidth = E.shadowCascadeWidth[x];
              F.shadowMapHeight = E.shadowCascadeHeight[x];
              F.pointsWorld = [];
              F.pointsFrustum = [];
              t = F.pointsWorld;
              u = F.pointsFrustum;
              for (var z = 0; 8 > z; z++)
                (t[z] = new THREE.Vector3()), (u[z] = new THREE.Vector3());
              t = E.shadowCascadeNearZ[x];
              E = E.shadowCascadeFarZ[x];
              u[0].set(-1, -1, t);
              u[1].set(1, -1, t);
              u[2].set(-1, 1, t);
              u[3].set(1, 1, t);
              u[4].set(-1, -1, E);
              u[5].set(1, -1, E);
              u[6].set(-1, 1, E);
              u[7].set(1, 1, E);
              F.originalCamera = l;
              u = new THREE.Gyroscope();
              u.position = n.shadowCascadeOffset;
              u.add(F);
              u.add(F.target);
              l.add(u);
              n.shadowCascadeArray[y] = F;
              console.log("Created virtualLight", F);
            }
            x = n;
            t = y;
            E = x.shadowCascadeArray[t];
            E.position.copy(x.position);
            E.target.position.copy(x.target.position);
            E.lookAt(E.target);
            E.shadowCameraVisible = x.shadowCameraVisible;
            E.shadowDarkness = x.shadowDarkness;
            E.shadowBias = x.shadowCascadeBias[t];
            u = x.shadowCascadeNearZ[t];
            x = x.shadowCascadeFarZ[t];
            E = E.pointsFrustum;
            E[0].z = u;
            E[1].z = u;
            E[2].z = u;
            E[3].z = u;
            E[4].z = x;
            E[5].z = x;
            E[6].z = x;
            E[7].z = x;
            J[q] = F;
            q++;
          }
        else (J[q] = n), q++;
    r = 0;
    for (s = J.length; r < s; r++) {
      n = J[r];
      n.shadowMap ||
        ((y = THREE.LinearFilter),
        b.shadowMapType === THREE.PCFSoftShadowMap && (y = THREE.NearestFilter),
        (n.shadowMap = new THREE.WebGLRenderTarget(
          n.shadowMapWidth,
          n.shadowMapHeight,
          { minFilter: y, magFilter: y, format: THREE.RGBAFormat }
        )),
        (n.shadowMapSize = new THREE.Vector2(
          n.shadowMapWidth,
          n.shadowMapHeight
        )),
        (n.shadowMatrix = new THREE.Matrix4()));
      if (!n.shadowCamera) {
        if (n instanceof THREE.SpotLight)
          n.shadowCamera = new THREE.PerspectiveCamera(
            n.shadowCameraFov,
            n.shadowMapWidth / n.shadowMapHeight,
            n.shadowCameraNear,
            n.shadowCameraFar
          );
        else if (n instanceof THREE.DirectionalLight)
          n.shadowCamera = new THREE.OrthographicCamera(
            n.shadowCameraLeft,
            n.shadowCameraRight,
            n.shadowCameraTop,
            n.shadowCameraBottom,
            n.shadowCameraNear,
            n.shadowCameraFar
          );
        else {
          console.error("Unsupported light type for shadow");
          continue;
        }
        p.add(n.shadowCamera);
        !0 === p.autoUpdate && p.updateMatrixWorld();
      }
      n.shadowCameraVisible &&
        !n.cameraHelper &&
        ((n.cameraHelper = new THREE.CameraHelper(n.shadowCamera)),
        n.shadowCamera.add(n.cameraHelper));
      if (n.isVirtual && F.originalCamera == l) {
        y = l;
        q = n.shadowCamera;
        u = n.pointsFrustum;
        E = n.pointsWorld;
        i.set(Infinity, Infinity, Infinity);
        j.set(-Infinity, -Infinity, -Infinity);
        for (x = 0; 8 > x; x++)
          (t = E[x]),
            t.copy(u[x]),
            THREE.ShadowMapPlugin.__projector.unprojectVector(t, y),
            t.applyMatrix4(q.matrixWorldInverse),
            t.x < i.x && (i.x = t.x),
            t.x > j.x && (j.x = t.x),
            t.y < i.y && (i.y = t.y),
            t.y > j.y && (j.y = t.y),
            t.z < i.z && (i.z = t.z),
            t.z > j.z && (j.z = t.z);
        q.left = i.x;
        q.right = j.x;
        q.top = j.y;
        q.bottom = i.y;
        q.updateProjectionMatrix();
      }
      q = n.shadowMap;
      u = n.shadowMatrix;
      y = n.shadowCamera;
      y.position.getPositionFromMatrix(n.matrixWorld);
      m.getPositionFromMatrix(n.target.matrixWorld);
      y.lookAt(m);
      y.updateMatrixWorld();
      y.matrixWorldInverse.getInverse(y.matrixWorld);
      n.cameraHelper && (n.cameraHelper.visible = n.shadowCameraVisible);
      n.shadowCameraVisible && n.cameraHelper.update();
      u.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      u.multiply(y.projectionMatrix);
      u.multiply(y.matrixWorldInverse);
      h.multiplyMatrices(y.projectionMatrix, y.matrixWorldInverse);
      g.setFromMatrix(h);
      b.setRenderTarget(q);
      b.clear();
      E = p.__webglObjects;
      n = 0;
      for (q = E.length; n < q; n++)
        if (
          ((x = E[n]),
          (u = x.object),
          (x.render = !1),
          u.visible &&
            u.castShadow &&
            (!(u instanceof THREE.Mesh || u instanceof THREE.ParticleSystem) ||
              !u.frustumCulled ||
              g.intersectsObject(u)))
        )
          u._modelViewMatrix.multiplyMatrices(
            y.matrixWorldInverse,
            u.matrixWorld
          ),
            (x.render = !0);
      n = 0;
      for (q = E.length; n < q; n++)
        (x = E[n]),
          x.render &&
            ((u = x.object),
            (x = x.buffer),
            (z =
              u.material instanceof THREE.MeshFaceMaterial
                ? u.material.materials[0]
                : u.material),
            (t = 0 < u.geometry.morphTargets.length && z.morphTargets),
            (z = u instanceof THREE.SkinnedMesh && z.skinning),
            (t = u.customDepthMaterial
              ? u.customDepthMaterial
              : z
              ? t
                ? f
                : e
              : t
              ? d
              : c),
            x instanceof THREE.BufferGeometry
              ? b.renderBufferDirect(y, p.__lights, null, t, x, u)
              : b.renderBuffer(y, p.__lights, null, t, x, u));
      E = p.__webglObjectsImmediate;
      n = 0;
      for (q = E.length; n < q; n++)
        (x = E[n]),
          (u = x.object),
          u.visible &&
            u.castShadow &&
            (u._modelViewMatrix.multiplyMatrices(
              y.matrixWorldInverse,
              u.matrixWorld
            ),
            b.renderImmediateObject(y, p.__lights, null, c, u));
    }
    r = b.getClearColor();
    s = b.getClearAlpha();
    a.clearColor(r.r, r.g, r.b, s);
    a.enable(a.BLEND);
    b.shadowMapCullFace === THREE.CullFaceFront && a.cullFace(a.BACK);
  };
};
THREE.ShadowMapPlugin.__projector = new THREE.Projector();
THREE.SpritePlugin = function () {
  function a(a, b) {
    return a.z !== b.z ? b.z - a.z : b.id - a.id;
  }
  var b, c, d, e, f, g, h, i, j, m;
  this.init = function (a) {
    b = a.context;
    c = a;
    d = a.getPrecision();
    e = new Float32Array(16);
    f = new Uint16Array(6);
    a = 0;
    e[a++] = -1;
    e[a++] = -1;
    e[a++] = 0;
    e[a++] = 0;
    e[a++] = 1;
    e[a++] = -1;
    e[a++] = 1;
    e[a++] = 0;
    e[a++] = 1;
    e[a++] = 1;
    e[a++] = 1;
    e[a++] = 1;
    e[a++] = -1;
    e[a++] = 1;
    e[a++] = 0;
    e[a++] = 1;
    a = 0;
    f[a++] = 0;
    f[a++] = 1;
    f[a++] = 2;
    f[a++] = 0;
    f[a++] = 2;
    f[a++] = 3;
    g = b.createBuffer();
    h = b.createBuffer();
    b.bindBuffer(b.ARRAY_BUFFER, g);
    b.bufferData(b.ARRAY_BUFFER, e, b.STATIC_DRAW);
    b.bindBuffer(b.ELEMENT_ARRAY_BUFFER, h);
    b.bufferData(b.ELEMENT_ARRAY_BUFFER, f, b.STATIC_DRAW);
    var a = THREE.ShaderSprite.sprite,
      l = b.createProgram(),
      r = b.createShader(b.FRAGMENT_SHADER),
      s = b.createShader(b.VERTEX_SHADER),
      n = "precision " + d + " float;\n";
    b.shaderSource(r, n + a.fragmentShader);
    b.shaderSource(s, n + a.vertexShader);
    b.compileShader(r);
    b.compileShader(s);
    b.attachShader(l, r);
    b.attachShader(l, s);
    b.linkProgram(l);
    i = l;
    j = {};
    m = {};
    j.position = b.getAttribLocation(i, "position");
    j.uv = b.getAttribLocation(i, "uv");
    m.uvOffset = b.getUniformLocation(i, "uvOffset");
    m.uvScale = b.getUniformLocation(i, "uvScale");
    m.rotation = b.getUniformLocation(i, "rotation");
    m.scale = b.getUniformLocation(i, "scale");
    m.alignment = b.getUniformLocation(i, "alignment");
    m.color = b.getUniformLocation(i, "color");
    m.map = b.getUniformLocation(i, "map");
    m.opacity = b.getUniformLocation(i, "opacity");
    m.useScreenCoordinates = b.getUniformLocation(i, "useScreenCoordinates");
    m.sizeAttenuation = b.getUniformLocation(i, "sizeAttenuation");
    m.screenPosition = b.getUniformLocation(i, "screenPosition");
    m.modelViewMatrix = b.getUniformLocation(i, "modelViewMatrix");
    m.projectionMatrix = b.getUniformLocation(i, "projectionMatrix");
    m.fogType = b.getUniformLocation(i, "fogType");
    m.fogDensity = b.getUniformLocation(i, "fogDensity");
    m.fogNear = b.getUniformLocation(i, "fogNear");
    m.fogFar = b.getUniformLocation(i, "fogFar");
    m.fogColor = b.getUniformLocation(i, "fogColor");
    m.alphaTest = b.getUniformLocation(i, "alphaTest");
  };
  this.render = function (d, e, f, s) {
    var n = d.__webglSprites,
      q = n.length;
    if (q) {
      var y = j,
        u = m,
        x = s / f,
        f = 0.5 * f,
        t = 0.5 * s;
      b.useProgram(i);
      b.enableVertexAttribArray(y.position);
      b.enableVertexAttribArray(y.uv);
      b.disable(b.CULL_FACE);
      b.enable(b.BLEND);
      b.bindBuffer(b.ARRAY_BUFFER, g);
      b.vertexAttribPointer(y.position, 2, b.FLOAT, !1, 16, 0);
      b.vertexAttribPointer(y.uv, 2, b.FLOAT, !1, 16, 8);
      b.bindBuffer(b.ELEMENT_ARRAY_BUFFER, h);
      b.uniformMatrix4fv(u.projectionMatrix, !1, e.projectionMatrix.elements);
      b.activeTexture(b.TEXTURE0);
      b.uniform1i(u.map, 0);
      var E = (y = 0),
        J = d.fog;
      J
        ? (b.uniform3f(u.fogColor, J.color.r, J.color.g, J.color.b),
          J instanceof THREE.Fog
            ? (b.uniform1f(u.fogNear, J.near),
              b.uniform1f(u.fogFar, J.far),
              b.uniform1i(u.fogType, 1),
              (E = y = 1))
            : J instanceof THREE.FogExp2 &&
              (b.uniform1f(u.fogDensity, J.density),
              b.uniform1i(u.fogType, 2),
              (E = y = 2)))
        : (b.uniform1i(u.fogType, 0), (E = y = 0));
      for (var F, z, H = [], J = 0; J < q; J++)
        (F = n[J]),
          (z = F.material),
          F.visible &&
            0 !== z.opacity &&
            (z.useScreenCoordinates
              ? (F.z = -F.position.z)
              : (F._modelViewMatrix.multiplyMatrices(
                  e.matrixWorldInverse,
                  F.matrixWorld
                ),
                (F.z = -F._modelViewMatrix.elements[14])));
      n.sort(a);
      for (J = 0; J < q; J++)
        (F = n[J]),
          (z = F.material),
          F.visible &&
            0 !== z.opacity &&
            z.map &&
            z.map.image &&
            z.map.image.width &&
            (b.uniform1f(u.alphaTest, z.alphaTest),
            !0 === z.useScreenCoordinates
              ? (b.uniform1i(u.useScreenCoordinates, 1),
                b.uniform3f(
                  u.screenPosition,
                  (F.position.x * c.devicePixelRatio - f) / f,
                  (t - F.position.y * c.devicePixelRatio) / t,
                  Math.max(0, Math.min(1, F.position.z))
                ),
                (H[0] = c.devicePixelRatio),
                (H[1] = c.devicePixelRatio))
              : (b.uniform1i(u.useScreenCoordinates, 0),
                b.uniform1i(u.sizeAttenuation, z.sizeAttenuation ? 1 : 0),
                b.uniformMatrix4fv(
                  u.modelViewMatrix,
                  !1,
                  F._modelViewMatrix.elements
                ),
                (H[0] = 1),
                (H[1] = 1)),
            (e = d.fog && z.fog ? E : 0),
            y !== e && (b.uniform1i(u.fogType, e), (y = e)),
            (e = 1 / (z.scaleByViewport ? s : 1)),
            (H[0] *= e * x * F.scale.x),
            (H[1] *= e * F.scale.y),
            b.uniform2f(u.uvScale, z.uvScale.x, z.uvScale.y),
            b.uniform2f(u.uvOffset, z.uvOffset.x, z.uvOffset.y),
            b.uniform2f(u.alignment, z.alignment.x, z.alignment.y),
            b.uniform1f(u.opacity, z.opacity),
            b.uniform3f(u.color, z.color.r, z.color.g, z.color.b),
            b.uniform1f(u.rotation, F.rotation),
            b.uniform2fv(u.scale, H),
            c.setBlending(z.blending, z.blendEquation, z.blendSrc, z.blendDst),
            c.setDepthTest(z.depthTest),
            c.setDepthWrite(z.depthWrite),
            c.setTexture(z.map, 0),
            b.drawElements(b.TRIANGLES, 6, b.UNSIGNED_SHORT, 0));
      b.enable(b.CULL_FACE);
    }
  };
};
THREE.DepthPassPlugin = function () {
  this.enabled = !1;
  this.renderTarget = null;
  var a,
    b,
    c,
    d,
    e,
    f,
    g = new THREE.Frustum(),
    h = new THREE.Matrix4();
  this.init = function (g) {
    a = g.context;
    b = g;
    var g = THREE.ShaderLib.depthRGBA,
      h = THREE.UniformsUtils.clone(g.uniforms);
    c = new THREE.ShaderMaterial({
      fragmentShader: g.fragmentShader,
      vertexShader: g.vertexShader,
      uniforms: h,
    });
    d = new THREE.ShaderMaterial({
      fragmentShader: g.fragmentShader,
      vertexShader: g.vertexShader,
      uniforms: h,
      morphTargets: !0,
    });
    e = new THREE.ShaderMaterial({
      fragmentShader: g.fragmentShader,
      vertexShader: g.vertexShader,
      uniforms: h,
      skinning: !0,
    });
    f = new THREE.ShaderMaterial({
      fragmentShader: g.fragmentShader,
      vertexShader: g.vertexShader,
      uniforms: h,
      morphTargets: !0,
      skinning: !0,
    });
    c._shadowPass = !0;
    d._shadowPass = !0;
    e._shadowPass = !0;
    f._shadowPass = !0;
  };
  this.render = function (a, b) {
    this.enabled && this.update(a, b);
  };
  this.update = function (i, j) {
    var m, p, l, r, s, n;
    a.clearColor(1, 1, 1, 1);
    a.disable(a.BLEND);
    b.setDepthTest(!0);
    !0 === i.autoUpdate && i.updateMatrixWorld();
    j.matrixWorldInverse.getInverse(j.matrixWorld);
    h.multiplyMatrices(j.projectionMatrix, j.matrixWorldInverse);
    g.setFromMatrix(h);
    b.setRenderTarget(this.renderTarget);
    b.clear();
    n = i.__webglObjects;
    m = 0;
    for (p = n.length; m < p; m++)
      if (
        ((l = n[m]),
        (s = l.object),
        (l.render = !1),
        s.visible &&
          (!(s instanceof THREE.Mesh || s instanceof THREE.ParticleSystem) ||
            !s.frustumCulled ||
            g.intersectsObject(s)))
      )
        s._modelViewMatrix.multiplyMatrices(
          j.matrixWorldInverse,
          s.matrixWorld
        ),
          (l.render = !0);
    var q;
    m = 0;
    for (p = n.length; m < p; m++)
      if (
        ((l = n[m]),
        l.render &&
          ((s = l.object),
          (l = l.buffer),
          !(s instanceof THREE.ParticleSystem) || s.customDepthMaterial))
      )
        (q =
          s.material instanceof THREE.MeshFaceMaterial
            ? s.material.materials[0]
            : s.material) && b.setMaterialFaces(s.material),
          (r = 0 < s.geometry.morphTargets.length && q.morphTargets),
          (q = s instanceof THREE.SkinnedMesh && q.skinning),
          (r = s.customDepthMaterial
            ? s.customDepthMaterial
            : q
            ? r
              ? f
              : e
            : r
            ? d
            : c),
          l instanceof THREE.BufferGeometry
            ? b.renderBufferDirect(j, i.__lights, null, r, l, s)
            : b.renderBuffer(j, i.__lights, null, r, l, s);
    n = i.__webglObjectsImmediate;
    m = 0;
    for (p = n.length; m < p; m++)
      (l = n[m]),
        (s = l.object),
        s.visible &&
          (s._modelViewMatrix.multiplyMatrices(
            j.matrixWorldInverse,
            s.matrixWorld
          ),
          b.renderImmediateObject(j, i.__lights, null, c, s));
    m = b.getClearColor();
    p = b.getClearAlpha();
    a.clearColor(m.r, m.g, m.b, p);
    a.enable(a.BLEND);
  };
};
THREE.ShaderFlares = {
  lensFlareVertexTexture: {
    vertexShader:
      "uniform lowp int renderType;\nuniform vec3 screenPosition;\nuniform vec2 scale;\nuniform float rotation;\nuniform sampler2D occlusionMap;\nattribute vec2 position;\nattribute vec2 uv;\nvarying vec2 vUV;\nvarying float vVisibility;\nvoid main() {\nvUV = uv;\nvec2 pos = position;\nif( renderType == 2 ) {\nvec4 visibility = texture2D( occlusionMap, vec2( 0.1, 0.1 ) ) +\ntexture2D( occlusionMap, vec2( 0.5, 0.1 ) ) +\ntexture2D( occlusionMap, vec2( 0.9, 0.1 ) ) +\ntexture2D( occlusionMap, vec2( 0.9, 0.5 ) ) +\ntexture2D( occlusionMap, vec2( 0.9, 0.9 ) ) +\ntexture2D( occlusionMap, vec2( 0.5, 0.9 ) ) +\ntexture2D( occlusionMap, vec2( 0.1, 0.9 ) ) +\ntexture2D( occlusionMap, vec2( 0.1, 0.5 ) ) +\ntexture2D( occlusionMap, vec2( 0.5, 0.5 ) );\nvVisibility = (       visibility.r / 9.0 ) *\n( 1.0 - visibility.g / 9.0 ) *\n(       visibility.b / 9.0 ) *\n( 1.0 - visibility.a / 9.0 );\npos.x = cos( rotation ) * position.x - sin( rotation ) * position.y;\npos.y = sin( rotation ) * position.x + cos( rotation ) * position.y;\n}\ngl_Position = vec4( ( pos * scale + screenPosition.xy ).xy, screenPosition.z, 1.0 );\n}",
    fragmentShader:
      "uniform lowp int renderType;\nuniform sampler2D map;\nuniform float opacity;\nuniform vec3 color;\nvarying vec2 vUV;\nvarying float vVisibility;\nvoid main() {\nif( renderType == 0 ) {\ngl_FragColor = vec4( 1.0, 0.0, 1.0, 0.0 );\n} else if( renderType == 1 ) {\ngl_FragColor = texture2D( map, vUV );\n} else {\nvec4 texture = texture2D( map, vUV );\ntexture.a *= opacity * vVisibility;\ngl_FragColor = texture;\ngl_FragColor.rgb *= color;\n}\n}",
  },
  lensFlare: {
    vertexShader:
      "uniform lowp int renderType;\nuniform vec3 screenPosition;\nuniform vec2 scale;\nuniform float rotation;\nattribute vec2 position;\nattribute vec2 uv;\nvarying vec2 vUV;\nvoid main() {\nvUV = uv;\nvec2 pos = position;\nif( renderType == 2 ) {\npos.x = cos( rotation ) * position.x - sin( rotation ) * position.y;\npos.y = sin( rotation ) * position.x + cos( rotation ) * position.y;\n}\ngl_Position = vec4( ( pos * scale + screenPosition.xy ).xy, screenPosition.z, 1.0 );\n}",
    fragmentShader:
      "precision mediump float;\nuniform lowp int renderType;\nuniform sampler2D map;\nuniform sampler2D occlusionMap;\nuniform float opacity;\nuniform vec3 color;\nvarying vec2 vUV;\nvoid main() {\nif( renderType == 0 ) {\ngl_FragColor = vec4( texture2D( map, vUV ).rgb, 0.0 );\n} else if( renderType == 1 ) {\ngl_FragColor = texture2D( map, vUV );\n} else {\nfloat visibility = texture2D( occlusionMap, vec2( 0.5, 0.1 ) ).a +\ntexture2D( occlusionMap, vec2( 0.9, 0.5 ) ).a +\ntexture2D( occlusionMap, vec2( 0.5, 0.9 ) ).a +\ntexture2D( occlusionMap, vec2( 0.1, 0.5 ) ).a;\nvisibility = ( 1.0 - visibility / 4.0 );\nvec4 texture = texture2D( map, vUV );\ntexture.a *= opacity * visibility;\ngl_FragColor = texture;\ngl_FragColor.rgb *= color;\n}\n}",
  },
};
THREE.ShaderSprite = {
  sprite: {
    vertexShader:
      "uniform int useScreenCoordinates;\nuniform int sizeAttenuation;\nuniform vec3 screenPosition;\nuniform mat4 modelViewMatrix;\nuniform mat4 projectionMatrix;\nuniform float rotation;\nuniform vec2 scale;\nuniform vec2 alignment;\nuniform vec2 uvOffset;\nuniform vec2 uvScale;\nattribute vec2 position;\nattribute vec2 uv;\nvarying vec2 vUV;\nvoid main() {\nvUV = uvOffset + uv * uvScale;\nvec2 alignedPosition = position + alignment;\nvec2 rotatedPosition;\nrotatedPosition.x = ( cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y ) * scale.x;\nrotatedPosition.y = ( sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y ) * scale.y;\nvec4 finalPosition;\nif( useScreenCoordinates != 0 ) {\nfinalPosition = vec4( screenPosition.xy + rotatedPosition, screenPosition.z, 1.0 );\n} else {\nfinalPosition = projectionMatrix * modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );\nfinalPosition.xy += rotatedPosition * ( sizeAttenuation == 1 ? 1.0 : finalPosition.z );\n}\ngl_Position = finalPosition;\n}",
    fragmentShader:
      "uniform vec3 color;\nuniform sampler2D map;\nuniform float opacity;\nuniform int fogType;\nuniform vec3 fogColor;\nuniform float fogDensity;\nuniform float fogNear;\nuniform float fogFar;\nuniform float alphaTest;\nvarying vec2 vUV;\nvoid main() {\nvec4 texture = texture2D( map, vUV );\nif ( texture.a < alphaTest ) discard;\ngl_FragColor = vec4( color * texture.xyz, texture.a * opacity );\nif ( fogType > 0 ) {\nfloat depth = gl_FragCoord.z / gl_FragCoord.w;\nfloat fogFactor = 0.0;\nif ( fogType == 1 ) {\nfogFactor = smoothstep( fogNear, fogFar, depth );\n} else {\nconst float LOG2 = 1.442695;\nfloat fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );\nfogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );\n}\ngl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor );\n}\n}",
  },
};
var Detector = {
  canvas: !!window.CanvasRenderingContext2D,
  webgl: (function () {
    try {
      return (
        !!window.WebGLRenderingContext &&
        !!document.createElement("canvas").getContext("experimental-webgl")
      );
    } catch (e) {
      return false;
    }
  })(),
  workers: !!window.Worker,
  fileapi: window.File && window.FileReader && window.FileList && window.Blob,
  getWebGLErrorMessage: function () {
    var element = document.createElement("div");
    element.id = "webgl-error-message";
    element.style.fontFamily = "monospace";
    element.style.fontSize = "13px";
    element.style.fontWeight = "normal";
    element.style.textAlign = "center";
    element.style.background = "#fff";
    element.style.color = "#000";
    element.style.padding = "1.5em";
    element.style.width = "400px";
    element.style.margin = "5em auto 0";
    if (!this.webgl)
      element.innerHTML = window.WebGLRenderingContext
        ? [
            'Your graphics card does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">WebGL</a>.<br />',
            'Find out how to get it <a href="http://get.webgl.org/" style="color:#000">here</a>.',
          ].join("\n")
        : [
            'Your browser does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">WebGL</a>.<br/>',
            'Find out how to get it <a href="http://get.webgl.org/" style="color:#000">here</a>.',
          ].join("\n");
    return element;
  },
  addGetWebGLMessage: function (parameters) {
    var parent, id, element;
    parameters = parameters || {};
    parent =
      parameters.parent !== undefined ? parameters.parent : document.body;
    id = parameters.id !== undefined ? parameters.id : "oldie";
    element = Detector.getWebGLErrorMessage();
    element.id = id;
    parent.appendChild(element);
  },
};
THREE.TrackballControls = function (object, domElement) {
  var _this = this;
  var STATE = {
    NONE: -1,
    ROTATE: 0,
    ZOOM: 1,
    PAN: 2,
    TOUCH_ROTATE: 3,
    TOUCH_ZOOM: 4,
    TOUCH_PAN: 5,
  };
  this.object = object;
  this.domElement = domElement !== undefined ? domElement : document;
  this.enabled = true;
  this.screen = { width: 0, height: 0, offsetLeft: 0, offsetTop: 0 };
  this.radius = (this.screen.width + this.screen.height) / 4;
  this.rotateSpeed = 1;
  this.zoomSpeed = 1.2;
  this.panSpeed = 0.3;
  this.noRotate = false;
  this.noZoom = false;
  this.noPan = false;
  this.staticMoving = false;
  this.dynamicDampingFactor = 0.2;
  this.minDistance = 0;
  this.maxDistance = Infinity;
  this.keys = [65, 83, 68];
  this.target = new THREE.Vector3();
  var lastPosition = new THREE.Vector3();
  var _state = STATE.NONE,
    _prevState = STATE.NONE,
    _eye = new THREE.Vector3(),
    _rotateStart = new THREE.Vector3(),
    _rotateEnd = new THREE.Vector3(),
    _zoomStart = new THREE.Vector2(),
    _zoomEnd = new THREE.Vector2(),
    _touchZoomDistanceStart = 0,
    _touchZoomDistanceEnd = 0,
    _panStart = new THREE.Vector2(),
    _panEnd = new THREE.Vector2();
  this.target0 = this.target.clone();
  this.position0 = this.object.position.clone();
  this.up0 = this.object.up.clone();
  var changeEvent = { type: "change" };
  this.handleResize = function () {
    this.screen.width = window.innerWidth;
    this.screen.height = window.innerHeight;
    this.screen.offsetLeft = 0;
    this.screen.offsetTop = 0;
    this.radius = (this.screen.width + this.screen.height) / 4;
  };
  this.handleEvent = function (event) {
    if (typeof this[event.type] == "function") this[event.type](event);
  };
  this.getMouseOnScreen = function (clientX, clientY) {
    return new THREE.Vector2(
      ((clientX - _this.screen.offsetLeft) / _this.radius) * 0.5,
      ((clientY - _this.screen.offsetTop) / _this.radius) * 0.5
    );
  };
  this.getMouseProjectionOnBall = function (clientX, clientY) {
    var mouseOnBall = new THREE.Vector3(
      (clientX - _this.screen.width * 0.5 - _this.screen.offsetLeft) /
        _this.radius,
      (_this.screen.height * 0.5 + _this.screen.offsetTop - clientY) /
        _this.radius,
      0
    );
    var length = mouseOnBall.length();
    if (length > 1) mouseOnBall.normalize();
    else mouseOnBall.z = Math.sqrt(1 - length * length);
    _eye.copy(_this.object.position).sub(_this.target);
    var projection = _this.object.up.clone().setLength(mouseOnBall.y);
    projection.add(
      _this.object.up.clone().cross(_eye).setLength(mouseOnBall.x)
    );
    projection.add(_eye.setLength(mouseOnBall.z));
    return projection;
  };
  this.forceRotate = function (start, end) {
    _rotateStart = start;
    _rotateEnd = end;
    this.rotateCamera();
  };
  this.rotateCamera = function () {
    var angle = Math.acos(
      _rotateStart.dot(_rotateEnd) / _rotateStart.length() / _rotateEnd.length()
    );
    if (angle) {
      var axis = new THREE.Vector3()
          .crossVectors(_rotateStart, _rotateEnd)
          .normalize(),
        quaternion = new THREE.Quaternion();
      angle *= _this.rotateSpeed;
      quaternion.setFromAxisAngle(axis, -angle);
      _eye.applyQuaternion(quaternion);
      _this.object.up.applyQuaternion(quaternion);
      _rotateEnd.applyQuaternion(quaternion);
      if (_this.staticMoving) _rotateStart.copy(_rotateEnd);
      else {
        quaternion.setFromAxisAngle(
          axis,
          angle * (_this.dynamicDampingFactor - 1)
        );
        _rotateStart.applyQuaternion(quaternion);
      }
    }
  };
  this.zoomCamera = function () {
    if (_state === STATE.TOUCH_ZOOM) {
      var factor = _touchZoomDistanceStart / _touchZoomDistanceEnd;
      _touchZoomDistanceStart = _touchZoomDistanceEnd;
      _eye.multiplyScalar(factor);
    } else {
      var factor = 1 + (_zoomEnd.y - _zoomStart.y) * _this.zoomSpeed;
      if (factor !== 1 && factor > 0) {
        _eye.multiplyScalar(factor);
        if (_this.staticMoving) _zoomStart.copy(_zoomEnd);
        else
          _zoomStart.y +=
            (_zoomEnd.y - _zoomStart.y) * this.dynamicDampingFactor;
      }
    }
  };
  this.panCamera = function () {
    var mouseChange = _panEnd.clone().sub(_panStart);
    if (mouseChange.lengthSq()) {
      mouseChange.multiplyScalar(_eye.length() * _this.panSpeed);
      var pan = _eye.clone().cross(_this.object.up).setLength(mouseChange.x);
      pan.add(_this.object.up.clone().setLength(mouseChange.y));
      _this.object.position.add(pan);
      _this.target.add(pan);
      if (_this.staticMoving) _panStart = _panEnd;
      else
        _panStart.add(
          mouseChange
            .subVectors(_panEnd, _panStart)
            .multiplyScalar(_this.dynamicDampingFactor)
        );
    }
  };
  this.checkDistances = function () {
    if (!_this.noZoom || !_this.noPan) {
      if (
        _this.object.position.lengthSq() >
        _this.maxDistance * _this.maxDistance
      )
        _this.object.position.setLength(_this.maxDistance);
      if (_eye.lengthSq() < _this.minDistance * _this.minDistance)
        _this.object.position.addVectors(
          _this.target,
          _eye.setLength(_this.minDistance)
        );
    }
  };
  this.update = function () {
    _eye.subVectors(_this.object.position, _this.target);
    if (!_this.noRotate) _this.rotateCamera();
    if (!_this.noZoom) _this.zoomCamera();
    if (!_this.noPan) _this.panCamera();
    _this.object.position.addVectors(_this.target, _eye);
    _this.checkDistances();
    _this.object.lookAt(_this.target);
    if (lastPosition.distanceToSquared(_this.object.position) > 0) {
      _this.dispatchEvent(changeEvent);
      lastPosition.copy(_this.object.position);
    }
  };
  this.reset = function () {
    _state = STATE.NONE;
    _prevState = STATE.NONE;
    _this.target.copy(_this.target0);
    _this.object.position.copy(_this.position0);
    _this.object.up.copy(_this.up0);
    _eye.subVectors(_this.object.position, _this.target);
    _this.object.lookAt(_this.target);
    _this.dispatchEvent(changeEvent);
    lastPosition.copy(_this.object.position);
  };
  function keydown(event) {
    if (_this.enabled === false) return;
    window.removeEventListener("keydown", keydown);
    _prevState = _state;
    if (_state !== STATE.NONE) return;
    else if (event.keyCode === _this.keys[STATE.ROTATE] && !_this.noRotate)
      _state = STATE.ROTATE;
    else if (event.keyCode === _this.keys[STATE.ZOOM] && !_this.noZoom)
      _state = STATE.ZOOM;
    else if (event.keyCode === _this.keys[STATE.PAN] && !_this.noPan)
      _state = STATE.PAN;
  }
  function keyup(event) {
    if (_this.enabled === false) return;
    _state = _prevState;
    window.addEventListener("keydown", keydown, false);
  }
  function mousedown(event) {
    if (_this.enabled === false) return;
    event.preventDefault();
    event.stopPropagation();
    if (_state === STATE.NONE) _state = event.button;
    if (_state === STATE.ROTATE && !_this.noRotate)
      _rotateStart = _rotateEnd = _this.getMouseProjectionOnBall(
        event.clientX,
        event.clientY
      );
    else if (_state === STATE.ZOOM && !_this.noZoom)
      _zoomStart = _zoomEnd = _this.getMouseOnScreen(
        event.clientX,
        event.clientY
      );
    else if (_state === STATE.PAN && !_this.noPan)
      _panStart = _panEnd = _this.getMouseOnScreen(
        event.clientX,
        event.clientY
      );
    document.addEventListener("mousemove", mousemove, false);
    document.addEventListener("mouseup", mouseup, false);
  }
  function mousemove(event) {
    if (_this.enabled === false) return;
    event.preventDefault();
    event.stopPropagation();
    if (_state === STATE.ROTATE && !_this.noRotate)
      _rotateEnd = _this.getMouseProjectionOnBall(event.clientX, event.clientY);
    else if (_state === STATE.ZOOM && !_this.noZoom)
      _zoomEnd = _this.getMouseOnScreen(event.clientX, event.clientY);
    else if (_state === STATE.PAN && !_this.noPan)
      _panEnd = _this.getMouseOnScreen(event.clientX, event.clientY);
  }
  function mouseup(event) {
    if (_this.enabled === false) return;
    event.preventDefault();
    event.stopPropagation();
    _state = STATE.NONE;
    document.removeEventListener("mousemove", mousemove);
    document.removeEventListener("mouseup", mouseup);
  }
  function mousewheel(event) {
    if (_this.enabled === false) return;
    event.preventDefault();
    event.stopPropagation();
    var delta = 0;
    if (event.wheelDelta) delta = event.wheelDelta / 40;
    else if (event.detail) delta = -event.detail / 3;
    _zoomStart.y += delta * 0.01;
  }
  function touchstart(event) {
    if (_this.enabled === false) return;
    switch (event.touches.length) {
      case 1:
        _state = STATE.TOUCH_ROTATE;
        _rotateStart = _rotateEnd = _this.getMouseProjectionOnBall(
          event.touches[0].pageX,
          event.touches[0].pageY
        );
        break;
      case 2:
        _state = STATE.TOUCH_ZOOM;
        var dx = event.touches[0].pageX - event.touches[1].pageX;
        var dy = event.touches[0].pageY - event.touches[1].pageY;
        _touchZoomDistanceEnd = _touchZoomDistanceStart = Math.sqrt(
          dx * dx + dy * dy
        );
        break;
      case 3:
        _state = STATE.TOUCH_PAN;
        _panStart = _panEnd = _this.getMouseOnScreen(
          event.touches[0].pageX,
          event.touches[0].pageY
        );
        break;
      default:
        _state = STATE.NONE;
    }
  }
  function touchmove(event) {
    if (_this.enabled === false) return;
    event.preventDefault();
    event.stopPropagation();
    switch (event.touches.length) {
      case 1:
        _rotateEnd = _this.getMouseProjectionOnBall(
          event.touches[0].pageX,
          event.touches[0].pageY
        );
        break;
      case 2:
        var dx = event.touches[0].pageX - event.touches[1].pageX;
        var dy = event.touches[0].pageY - event.touches[1].pageY;
        _touchZoomDistanceEnd = Math.sqrt(dx * dx + dy * dy);
        break;
      case 3:
        _panEnd = _this.getMouseOnScreen(
          event.touches[0].pageX,
          event.touches[0].pageY
        );
        break;
      default:
        _state = STATE.NONE;
    }
  }
  function touchend(event) {
    if (_this.enabled === false) return;
    switch (event.touches.length) {
      case 1:
        _rotateStart = _rotateEnd = _this.getMouseProjectionOnBall(
          event.touches[0].pageX,
          event.touches[0].pageY
        );
        break;
      case 2:
        _touchZoomDistanceStart = _touchZoomDistanceEnd = 0;
        break;
      case 3:
        _panStart = _panEnd = _this.getMouseOnScreen(
          event.touches[0].pageX,
          event.touches[0].pageY
        );
        break;
    }
    _state = STATE.NONE;
  }
  this.domElement.addEventListener(
    "contextmenu",
    function (event) {
      event.preventDefault();
    },
    false
  );
  this.domElement.addEventListener("mousedown", mousedown, false);
  this.domElement.addEventListener("mousewheel", mousewheel, false);
  this.domElement.addEventListener("DOMMouseScroll", mousewheel, false);
  this.domElement.addEventListener("touchstart", touchstart, false);
  this.domElement.addEventListener("touchend", touchend, false);
  this.domElement.addEventListener("touchmove", touchmove, false);
  window.addEventListener("keydown", keydown, false);
  window.addEventListener("keyup", keyup, false);
  this.handleResize();
};
THREE.TrackballControls.prototype = Object.create(
  THREE.EventDispatcher.prototype
);
var THREEx = THREEx || {};
THREEx.WindowResize = function (renderer, camera, container) {
  container = container || window;
  var $c = $(container);
  var callback = function () {
    renderer.setSize($(window).width(), $c.height());
    camera.aspect = $c.width() / $c.height();
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", callback, false);
  return {
    stop: function () {
      window.removeEventListener("resize", callback);
    },
  };
};
THREEx.WindowResize.bind = function (renderer, camera) {
  return THREEx.WindowResize(renderer, camera);
};
(function () {
  var pi = Math.PI;
  var PIXELS_PER_AU = 50;
  var USE_REAL_ELLIPSE = true;
  var attributes;
  var uniforms;
  var Orbit3D = function (eph, opts, bigParticle) {
    opts = opts || {};
    opts.width = opts.width || 1;
    opts.object_size = opts.object_size || 1;
    opts.jed = opts.jed || 2451545;
    this.opts = opts;
    this.name = opts.name;
    this.eph = eph;
    this.particle_geometry = opts.particle_geometry;
    this.bigParticle = bigParticle;
    this.CreateParticle(opts.jed, opts.texture_path);
  };
  Orbit3D.prototype.CreateOrbit = function (jed) {
    var pts;
    var points;
    var time = jed;
    var pts = [];
    var limit = this.eph.P ? this.eph.P + 1 : this.eph.per;
    var parts = this.eph.e > 0.2 ? 300 : 100;
    var delta = Math.ceil(limit / parts);
    var prev;
    for (var i = 0; i <= parts; i++, time += delta) {
      var pos = this.getPosAtTime(time);
      var vector = new THREE.Vector3(pos[0], pos[1], pos[2]);
      prev = vector;
      pts.push(vector);
    }
    points = new THREE.Geometry();
    points.vertices = pts;
    points.computeLineDistances();
    var line = new THREE.Line(
      points,
      new THREE.LineDashedMaterial({
        color: this.opts.color,
        linewidth: this.opts.width,
        dashSize: 1,
        gapSize: 0.5,
      }),
      THREE.LineStrip
    );
    return line;
  };
  Orbit3D.prototype.CreateParticle = function (jed, texture_path) {
    if (!this.bigParticle && this.particle_geometry) {
      var tmp_vec = new THREE.Vector3(0, 0, 0);
      this.particle_geometry.vertices.push(tmp_vec);
      return;
    }
    var pos = this.getPosAtTime(jed);
    if (this.bigParticle) {
      var geometry = new THREE.SphereGeometry(this.opts.object_size);
      var mat_opts = { color: this.opts.color };
      if (texture_path)
        $.extend(mat_opts, {
          map: THREE.ImageUtils.loadTexture(texture_path),
          wireframe: false,
          overdraw: true,
        });
      var material = new THREE.MeshBasicMaterial(mat_opts);
      this.particle = new THREE.Mesh(geometry, material);
      this.particle.position.set(pos[0], pos[1], pos[2]);
    }
  };
  Orbit3D.prototype.MoveParticle = function (time_jed) {
    var pos = this.getPosAtTime(time_jed);
    this.MoveParticleToPosition(pos);
  };
  Orbit3D.prototype.MoveParticleToPosition = function (pos) {
    if (this.bigParticle) this.particle.position.set(pos[0], pos[1], pos[2]);
    else {
      var vertex_particle = this.particle_geometry.vertices[this.vertex_pos];
      vertex_particle.x = pos[0];
      vertex_particle.y = pos[1];
      vertex_particle.z = pos[2];
    }
  };
  Orbit3D.prototype.getPosAtTime = function (jed) {
    var e = this.eph.e;
    var a = this.eph.a;
    var i = (this.eph.i * pi) / 180;
    var o = (this.eph.om * pi) / 180;
    var p = ((this.eph.w_bar || this.eph.w + this.eph.om) * pi) / 180;
    var ma = this.eph.ma;
    var M;
    ma = (ma * pi) / 180;
    var n;
    if (this.eph.n) n = (this.eph.n * pi) / 180;
    else n = (2 * pi) / this.eph.P;
    var epoch = this.eph.epoch;
    var d = jed - epoch;
    M = ma + n * d;
    var sin = Math.sin,
      cos = Math.cos;
    var E0 = M;
    var lastdiff;
    do {
      var E1 = M + e * sin(E0);
      lastdiff = Math.abs(E1 - E0);
      E0 = E1;
    } while (lastdiff > 1e-7);
    var E = E0;
    var v = 2 * Math.atan(Math.sqrt((1 + e) / (1 - e)) * Math.tan(E / 2));
    var r = ((a * (1 - e * e)) / (1 + e * cos(v))) * PIXELS_PER_AU;
    var X = r * (cos(o) * cos(v + p - o) - sin(o) * sin(v + p - o) * cos(i));
    var Y = r * (sin(o) * cos(v + p - o) + cos(o) * sin(v + p - o) * cos(i));
    var Z = r * sin(v + p - o) * sin(i);
    var ret = [X, Y, Z];
    return ret;
  };
  Orbit3D.prototype.getEllipse = function () {
    if (!this.ellipse) this.ellipse = this.CreateOrbit(this.opts.jed);
    return this.ellipse;
  };
  Orbit3D.prototype.getParticle = function () {
    return this.particle;
  };
  window.Orbit3D = Orbit3D;
})();
window.Ephemeris = {
  asteroid_2012_da14: {
    full_name: "2012 DA14",
    ma: 299.99868,
    epoch: 2456200.5,
    n: 0.9828964,
    a: 1.0018381,
    e: 0.1081389,
    i: 10.33722,
    w_bar: 58.33968,
    w: 271.07725,
    om: 147.26243,
    P: 365.256,
  },
  mercury: {
    full_name: "Mercury",
    ma: 174.79252722,
    epoch: 2451545,
    a: 0.38709927,
    e: 0.20563593,
    i: 7.00497902,
    w_bar: 77.45779628,
    w: 29.12703035,
    L: 252.2503235,
    om: 48.33076593,
    P: 87.969,
  },
  venus: {
    full_name: "Venus",
    ma: 50.37663232,
    epoch: 2451545,
    a: 0.72333566,
    e: 0.00677672,
    i: 3.39467605,
    w_bar: 131.60246718,
    w: 54.92262463,
    L: 181.9790995,
    om: 76.67984255,
    P: 224.701,
  },
  earth: {
    full_name: "Earth",
    ma: -2.47311027,
    epoch: 2451545,
    a: 1.00000261,
    e: 0.01671123,
    i: 1.531e-5,
    w_bar: 102.93768193,
    w: 102.93768193,
    L: 100.46457166,
    om: 0,
    P: 365.256,
  },
  mars: {
    full_name: "Mars",
    ma: 19.39019754,
    epoch: 2451545,
    a: 1.52371034,
    e: 0.0933941,
    i: 1.84969142,
    w_bar: -23.94362959,
    w: -73.5031685,
    L: -4.55343205,
    om: 49.55953891,
    P: 686.98,
  },
  jupiter: {
    full_name: "Jupiter",
    ma: 19.66796068,
    epoch: 2451545,
    a: 5.202887,
    e: 0.04838624,
    i: 1.30439695,
    w_bar: 14.72847983,
    w: -85.74542926,
    L: 34.39644051,
    om: 100.47390909,
    P: 4332.589,
  },
};
for (var x in Ephemeris)
  if (Ephemeris.hasOwnProperty(x) && Ephemeris[x].w_bar && Ephemeris[x].L)
    Ephemeris[x].ma = Ephemeris[x].L - Ephemeris[x].w_bar;
function timedChunk(particles, positions, fn, context, callback) {
  var i = 0;
  var tick = function () {
    var start = new Date().getTime();
    for (; i < positions.length && new Date().getTime() - start < 50; i++)
      fn.call(context, particles[i], positions[i]);
    if (i < positions.length) setTimeout(tick, 25);
    else callback(positions, particles);
  };
  setTimeout(tick, 25);
}
function toJED(d) {
  return Math.floor(d.getTime() / (1e3 * 60 * 60 * 24) - 0.5) + 2440588;
}
function fromJED(jed) {
  return new Date(1e3 * 60 * 60 * 24 * (0.5 - 2440588 + jed));
}
function getColorFromPercent(value, highColor, lowColor) {
  var r = highColor >> 16;
  var g = (highColor >> 8) & 255;
  var b = highColor & 255;
  r += ((lowColor >> 16) - r) * value;
  g += (((lowColor >> 8) & 255) - g) * value;
  b += ((lowColor & 255) - b) * value;
  return (r << 16) | (g << 8) | b;
}
function displayColorForObject(roid) {
  return new THREE.Color(16777215);
}
function getParameterByName(name) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regexS = "[\\?&]" + name + "=([^&#]*)";
  var regex = new RegExp(regexS);
  var results = regex.exec(window.location.search);
  if (results == null) return "";
  else return decodeURIComponent(results[1].replace(/\+/g, " "));
}
function Asterank3D(opts) {
  var me = this;
  opts.static_prefix = opts.static_prefix || "/asterank/static";
  opts.default_camera_position = opts.camera_position || [0, 155, 32];
  opts.camera_fly_around =
    typeof opts.camera_fly_around === "undefined"
      ? true
      : opts.camera_fly_around;
  opts.jed_delta = opts.jed_delta || 0.25;
  opts.custom_object_fn = opts.custom_object_fn || null;
  opts.object_texture_path =
    opts.object_texture_path || opts.static_prefix + "/img/cloud4.png";
  opts.not_supported_callback = opts.not_supported_callback || function () {};
  opts.sun_scale = opts.sun_scale || 50;
  opts.show_dat_gui = opts.show_dat_gui || false;
  opts.top_object_color = opts.top_object_color
    ? new THREE.Color(opts.top_object_color)
    : new THREE.Color(14408560);
  opts.milky_way_visible = opts.milky_way_visible || true;
  window.requestAnimFrame = (function () {
    return (
      window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.oRequestAnimationFrame ||
      window.msRequestAnimationFrame ||
      function (callback) {
        window.setTimeout(callback, 1e3 / 60);
      }
    );
  })();
  var WEB_GL_ENABLED = true,
    MAX_NUM_ORBITS = 4e3,
    CANVAS_NUM_ORBITS = 15,
    PIXELS_PER_AU = 50,
    NUM_BIG_PARTICLES = 25;
  var stats,
    scene,
    renderer,
    composer,
    camera,
    cameraControls,
    pi = Math.PI,
    using_webgl = false,
    object_movement_on = true,
    lastHovered,
    added_objects = [],
    planets = [],
    planet_orbits_visible = true,
    jed = toJED(new Date()),
    particle_system_geometry = null,
    asteroids_loaded = false,
    display_date_last_updated = 0,
    first_loaded = false,
    skyBox = null;
  var feature_map = {},
    locked_object = null,
    locked_object_ellipse = null,
    locked_object_idx = -1,
    locked_object_size = -1,
    locked_object_color = -1;
  var featured_2012_da14 = getParameterByName("2012_DA14") === "1";
  var works = [],
    workers = [],
    NUM_WORKERS = 3,
    worker_path = opts.static_prefix + "/js/3d/position_worker.js",
    workers_initialized = false,
    particleSystem;
  var attributes, uniforms;
  init();
  if (opts.show_dat_gui) initGUI();
  $("#btn-toggle-movement").on("click", function () {
    object_movement_on = !object_movement_on;
  });
  $("#controls .js-sort").on("click", function () {
    runAsteroidQuery($(this).data("sort"));
    $("#controls .js-sort").css("font-weight", "normal");
    $(this).css("font-weight", "bold");
  });
  me.pause = function () {
    object_movement_on = false;
  };
  me.play = function () {
    object_movement_on = true;
  };
  if (featured_2012_da14) {
    jed = toJED(new Date("2012-11-01"));
    if (typeof mixpanel !== "undefined") mixpanel.track("2012_da14 special");
  }
  function initGUI() {
    var ViewUI = function () {
      this["Cost effective"] = function () {
        me.clearRankings();
        runAsteroidQuery("score");
      };
      this["Most valuable"] = function () {
        me.clearRankings();
        runAsteroidQuery("value");
      };
      this["Most accessible"] = function () {
        me.clearRankings();
        runAsteroidQuery("accessibility");
      };
      this["Smallest"] = function () {
        me.clearRankings();
        runAsteroidQuery("smallest");
      };
      this["Speed"] = opts.jed_delta;
      this["Planet orbits"] = planet_orbits_visible;
      this["Milky Way"] = opts.milky_way_visible;
      this["Display date"] = "12/26/2012";
    };
    window.onload = function () {
      var text = new ViewUI();
      var gui = new dat.GUI();
      gui.add(text, "Cost effective");
      gui.add(text, "Most valuable");
      gui.add(text, "Most accessible");
      gui.add(text, "Smallest");
      gui.add(text, "Speed", 0, 1).onChange(function (val) {
        opts.jed_delta = val;
        var was_moving = object_movement_on;
        object_movement_on = opts.jed_delta > 0;
        if (was_moving != object_movement_on)
          toggleSimulation(object_movement_on);
      });
      gui.add(text, "Planet orbits").onChange(function () {
        togglePlanetOrbits();
      });
      gui.add(text, "Milky Way").onChange(function () {
        toggleMilkyWay();
      });
      gui
        .add(text, "Display date")
        .onChange(function (val) {
          var newdate = new Date(Date.parse(val));
          if (newdate) {
            var newjed = toJED(newdate);
            changeJED(newjed);
            if (!object_movement_on) render(true);
          }
        })
        .listen();
      window.datgui = text;
    };
  }
  function togglePlanetOrbits() {
    if (planet_orbits_visible)
      for (var i = 0; i < planets.length; i++)
        scene.remove(planets[i].getEllipse());
    else
      for (var i = 0; i < planets.length; i++)
        scene.add(planets[i].getEllipse());
    planet_orbits_visible = !planet_orbits_visible;
  }
  function toggleMilkyWay() {
    skyBox.visible = opts.milky_way_visible = !opts.milky_way_visible;
  }
  function init() {
    $("#loading-text").html("renderer");
    if (WEB_GL_ENABLED && Detector.webgl) {
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setClearColor(0, 1);
      using_webgl = true;
      window.gl = renderer.getContext();
    } else {
      opts.not_supported_callback();
      return;
    }
    var $container = $(opts.container);
    var containerHeight = $container.height();
    var containerWidth = $container.width();
    renderer.setSize(containerWidth, containerHeight);
    opts.container.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    var cameraH = 3;
    var cameraW = (cameraH / containerHeight) * containerWidth;
    window.cam = camera = new THREE.PerspectiveCamera(
      75,
      containerWidth / containerHeight,
      1,
      5e3
    );
    setDefaultCameraPosition();
    THREEx.WindowResize(renderer, camera, opts.container);
    if (THREEx.FullScreen && THREEx.FullScreen.available())
      THREEx.FullScreen.bindKey();
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    scene.add(camera);
    cameraControls = new THREE.TrackballControls(camera, opts.container);
    cameraControls.staticMoving = true;
    cameraControls.panSpeed = 2;
    cameraControls.zoomSpeed = 3;
    cameraControls.rotateSpeed = 3;
    cameraControls.maxDistance = 1100;
    cameraControls.dynamicDampingFactor = 0.5;
    window.cc = cameraControls;
    cameraControls.forceRotate(
      new THREE.Vector3(
        0.09133858267716535,
        0.4658716047427351,
        0.1826620371691377
      ),
      new THREE.Vector3(
        -0.12932885444884135,
        0.35337196181704117,
        0.023557202790282953
      )
    );
    cameraControls.forceRotate(
      new THREE.Vector3(
        0.5557858773636077,
        0.7288978222072244,
        0.17927802044881952
      ),
      new THREE.Vector3(
        -0.0656536826099882,
        0.5746939531732201,
        0.7470641189675084
      )
    );
    if (using_webgl) {
      $("#loading-text").html("sun");
      var texture = loadTexture(opts.static_prefix + "/img/sunsprite.png");
      var sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          blending: THREE.AdditiveBlending,
          useScreenCoordinates: false,
          color: 16777215,
        })
      );
      sprite.scale.x = opts.sun_scale;
      sprite.scale.y = opts.sun_scale;
      sprite.scale.z = 1;
      scene.add(sprite);
    } else {
      var material = new THREE.ParticleBasicMaterial({
        map: new THREE.Texture(starTexture(16773793, 1)),
        blending: THREE.AdditiveBlending,
      });
      var particle = new THREE.Particle(material);
      particle.isClickable = false;
      scene.add(particle);
    }
    if (opts.run_asteroid_query) runAsteroidQuery();
    $("#loading-text").html("planets");
    var mercury = new Orbit3D(
      Ephemeris.mercury,
      {
        color: 9518318,
        width: 1,
        jed: jed,
        object_size: 1.7,
        texture_path: opts.static_prefix + "/img/texture-mercury.jpg",
        display_color: new THREE.Color(9518318),
        particle_geometry: particle_system_geometry,
        name: "Mercury",
      },
      !using_webgl
    );
    scene.add(mercury.getEllipse());
    if (!using_webgl) scene.add(mercury.getParticle());
    var venus = new Orbit3D(
      Ephemeris.venus,
      {
        color: 16742195,
        width: 1,
        jed: jed,
        object_size: 1.7,
        texture_path: opts.static_prefix + "/img/texture-venus.jpg",
        display_color: new THREE.Color(16742195),
        particle_geometry: particle_system_geometry,
        name: "Venus",
      },
      !using_webgl
    );
    scene.add(venus.getEllipse());
    if (!using_webgl) scene.add(venus.getParticle());
    var earth = new Orbit3D(
      Ephemeris.earth,
      {
        color: 39629,
        width: 1,
        jed: jed,
        object_size: 1.7,
        texture_path: opts.static_prefix + "/img/texture-earth.jpg",
        display_color: new THREE.Color(39629),
        particle_geometry: particle_system_geometry,
        name: "Earth",
      },
      !using_webgl
    );
    scene.add(earth.getEllipse());
    if (!using_webgl) scene.add(earth.getParticle());
    feature_map["earth"] = { orbit: earth, idx: 2 };
    var mars = new Orbit3D(
      Ephemeris.mars,
      {
        color: 10893882,
        width: 1,
        jed: jed,
        object_size: 1.7,
        texture_path: opts.static_prefix + "/img/texture-mars.jpg",
        display_color: new THREE.Color(10893882),
        particle_geometry: particle_system_geometry,
        name: "Mars",
      },
      !using_webgl
    );
    scene.add(mars.getEllipse());
    if (!using_webgl) scene.add(mars.getParticle());
    var jupiter = new Orbit3D(
      Ephemeris.jupiter,
      {
        color: 16744272,
        width: 1,
        jed: jed,
        object_size: 1.7,
        texture_path: opts.static_prefix + "/img/texture-jupiter.jpg",
        display_color: new THREE.Color(16744272),
        particle_geometry: particle_system_geometry,
        name: "Jupiter",
      },
      !using_webgl
    );
    scene.add(jupiter.getEllipse());
    if (!using_webgl) scene.add(jupiter.getParticle());
    planets = [mercury, venus, earth, mars, jupiter];
    if (featured_2012_da14) {
      var asteroid_2012_da14 = new Orbit3D(
        Ephemeris.asteroid_2012_da14,
        {
          color: 16711680,
          width: 1,
          jed: jed,
          object_size: 1.7,
          texture_path: opts.static_prefix + "/img/cloud4.png",
          display_color: new THREE.Color(16711680),
          particle_geometry: particle_system_geometry,
          name: "2012 DA14",
        },
        !using_webgl
      );
      scene.add(asteroid_2012_da14.getEllipse());
      if (!using_webgl) scene.add(asteroid_2012_da14.getParticle());
      feature_map["2012 DA14"] = { orbit: asteroid_2012_da14, idx: 5 };
      planets.push(asteroid_2012_da14);
    }
    if (using_webgl) {
      var materialArray = [];
      var path = opts.static_prefix + "/img/dark-s_";
      var format = ".jpg";
      var urls = [
        path + "px" + format,
        path + "nx" + format,
        path + "py" + format,
        path + "ny" + format,
        path + "pz" + format,
        path + "nz" + format,
      ];
      for (var i = 0; i < 6; i++)
        materialArray.push(
          new THREE.MeshBasicMaterial({
            map: loadTexture(urls[i]),
            side: THREE.BackSide,
          })
        );
      var skyGeometry = new THREE.CubeGeometry(5e3, 5e3, 5e3);
      var skyMaterial = new THREE.MeshFaceMaterial(materialArray);
      skyBox = new THREE.Mesh(skyGeometry, skyMaterial);
      skyBox.rotation.z = (pi * 25) / 32;
      skyBox.rotation.x = pi / 11;
      scene.add(skyBox);
    }
    $(opts.container).on("mousedown", function () {
      opts.camera_fly_around = false;
    });
    window.renderer = renderer;
  }
  function setNeutralCameraPosition() {
    var timer = 1e-4 * Date.now();
    cam.position.x = Math.sin(timer) * 25;
    cam.position.z = 100 + Math.cos(timer) * 20;
  }
  function setDefaultCameraPosition() {
    cam.position.set(
      opts.default_camera_position[0],
      opts.default_camera_position[1],
      opts.default_camera_position[2]
    );
  }
  function setHighlight(full_name) {
    var mapped_obj = feature_map[full_name];
    if (!mapped_obj) {
      alert("Sorry, something went wrong and I can't highlight this object.");
      return;
    }
    var orbit_obj = mapped_obj.orbit;
    if (!orbit_obj) {
      alert("Sorry, something went wrong and I can't highlight this object.");
      return;
    }
    var idx = mapped_obj.idx;
    if (using_webgl) {
      attributes.value_color.value[idx] = new THREE.Color(255);
      attributes.size.value[idx] = 30;
      attributes.locked.value[idx] = 1;
      setAttributeNeedsUpdateFlags();
    }
  }
  me.clearLock = function () {
    return clearLock(true);
  };
  function clearLock(set_default_camera) {
    if (!locked_object) return;
    if (set_default_camera) setDefaultCameraPosition();
    cameraControls.target = new THREE.Vector3(0, 0, 0);
    if (using_webgl) {
      attributes.value_color.value[locked_object_idx] = locked_object_color;
      attributes.size.value[locked_object_idx] = locked_object_size;
      attributes.locked.value[locked_object_idx] = 0;
      setAttributeNeedsUpdateFlags();
    }
    if (locked_object_idx >= planets.length)
      scene.remove(locked_object_ellipse);
    locked_object = null;
    locked_object_ellipse = null;
    locked_object_idx = -1;
    locked_object_size = -1;
    locked_object_color = null;
    setNeutralCameraPosition();
  }
  me.setLock = function (full_name) {
    return setLock(full_name);
  };
  function setLock(full_name) {
    if (locked_object) clearLock();
    var mapped_obj = feature_map[full_name];
    if (!mapped_obj) {
      alert("Sorry, something went wrong and I can't lock on this object.");
      return;
    }
    var orbit_obj = mapped_obj["orbit"];
    if (!orbit_obj) {
      alert("Sorry, something went wrong and I can't lock on this object.");
      return;
    }
    locked_object = orbit_obj;
    locked_object_idx = mapped_obj["idx"];
    if (using_webgl) {
      locked_object_color = attributes.value_color.value[locked_object_idx];
      attributes.value_color.value[locked_object_idx] =
        full_name === "earth"
          ? new THREE.Color(65280)
          : new THREE.Color(16711680);
      locked_object_size = attributes.size.value[locked_object_idx];
      attributes.size.value[locked_object_idx] = 30;
      attributes.locked.value[locked_object_idx] = 1;
      setAttributeNeedsUpdateFlags();
    }
    locked_object_ellipse = locked_object.getEllipse();
    scene.add(locked_object_ellipse);
    opts.camera_fly_around = true;
  }
  function startSimulation() {
    if (!asteroids_loaded)
      throw "couldn't start simulation: asteroids not loaded";
    if (!workers_initialized)
      throw "couldn't start simulation: simulation not initialized";
    for (var i = 0; i < workers.length; i++) {
      var particles = works[i];
      var obj_ephs = [];
      for (var j = 0; j < particles.length; j++)
        obj_ephs.push(particles[j].eph);
      workers[i].postMessage({
        command: "start",
        particle_ephemeris: obj_ephs,
        start_jed: jed,
      });
    }
  }
  function stopSimulation() {
    toggleSimulation(false);
  }
  function toggleSimulation(run) {
    for (var i = 0; i < workers.length; i++)
      workers[i].postMessage({ command: "toggle_simulation", val: run });
  }
  function initSimulation() {
    var l = added_objects.length;
    var objects_per_worker = Math.ceil(l / NUM_WORKERS);
    var remainder = l % NUM_WORKERS;
    for (var i = 0; i < NUM_WORKERS; i++) {
      workers[i] = new Worker(worker_path);
      var start = i * objects_per_worker;
      works[i] = added_objects.slice(
        start,
        Math.min(start + objects_per_worker, l)
      );
    }
    $.each(works, function (idx) {
      var work = this;
      workers[idx].onmessage = function (e) {
        handleSimulationResults(e, work.slice());
      };
    });
    workers_initialized = true;
  }
  function handleSimulationResults(e, particles) {
    var data = e.data;
    switch (data.type) {
      case "result":
        var positions = data.value.positions;
        for (var i = 0; i < positions.length; i++)
          particles[i].MoveParticleToPosition(positions[i]);
        if (typeof datgui !== "undefined") {
          var now = new Date().getTime();
          if (now - display_date_last_updated > 500) {
            var georgian_date = fromJED(data.value.jed);
            datgui["display date"] =
              georgian_date.getMonth() +
              1 +
              "/" +
              georgian_date.getDate() +
              "/" +
              georgian_date.getFullYear();
            display_date_last_updated = now;
          }
        }
        break;
      case "debug":
        console.log(data.value);
        break;
      default:
        console.log("Invalid data type", data.type);
    }
  }
  function runAsteroidQuery(sort) {
    sort = sort || "score";
    $("#loading").show();
    $("#loading-text").html("asteroids database");
    if (
      typeof passthrough_vars !== "undefined" &&
      passthrough_vars.offline_mode
    )
      setTimeout(function () {
        var data = window.passthrough_vars.rankings[sort];
        me.processAsteroidRankings(data);
      }, 0);
    else
      $.getJSON(
        "/asterank/api/rankings?sort_by=" +
          sort +
          "&limit=" +
          (using_webgl ? MAX_NUM_ORBITS : CANVAS_NUM_ORBITS) +
          "&orbits_only=true",
        function (data) {
          me.processAsteroidRankings(data);
        }
      ).error(function () {
        alert(
          "Sorry, we've encountered an error and we can't load the simulation"
        );
        mixpanel.track("3d error", { type: "json" });
      });
  }
  me.clearRankings = function () {
    for (var i = 0; i < added_objects.length; i++)
      scene.remove(added_objects[i].getParticle());
    clearLock(true);
    if (particleSystem) {
      scene.remove(particleSystem);
      particleSystem = null;
    }
    if (asteroids_loaded) stopSimulation();
    if (lastHovered) scene.remove(lastHovered);
  };
  me.processAsteroidRankings = function (data) {
    if (!data) {
      alert(
        "Sorry, something went wrong and the server failed to return data."
      );
      return;
    }
    var n = data.length;
    added_objects = planets.slice();
    particle_system_geometry = new THREE.Geometry();
    for (var i = 0; i < planets.length; i++)
      particle_system_geometry.vertices.push(new THREE.Vector3(0, 0, 0));
    var useBigParticles = !using_webgl;
    var featured_count = 0;
    var featured_html = "";
    for (var i = 0; i < n; i++) {
      if (i === NUM_BIG_PARTICLES) {
        if (!using_webgl) break;
        useBigParticles = false;
      }
      var roid = data[i];
      var locked = false;
      var orbit;
      if (opts.custom_object_fn) {
        var orbit_params = opts.custom_object_fn(roid);
        orbit_params.particle_geometry = particle_system_geometry;
        orbit_params.jed = jed;
        orbit = new Orbit3D(roid, orbit_params, useBigParticles);
      } else {
        var display_color =
          i < NUM_BIG_PARTICLES
            ? opts.top_object_color
            : displayColorForObject(roid);
        orbit = new Orbit3D(
          roid,
          {
            color: 13421772,
            display_color: display_color,
            width: 2,
            object_size: i < NUM_BIG_PARTICLES ? 50 : 15,
            jed: jed,
            particle_geometry: particle_system_geometry,
          },
          useBigParticles
        );
      }
      feature_map[roid.full_name] = { orbit: orbit, idx: added_objects.length };
      if (featured_count++ < NUM_BIG_PARTICLES)
        featured_html +=
          '<tr data-full-name="' +
          roid.full_name +
          '"><td><a href="#">' +
          (roid.prov_des || roid.full_name) +
          "</a></td><td>" +
          (roid.price < 1 ? "N/A" : "$" + fuzzy_price(roid.price)) +
          "</td></tr>";
      added_objects.push(orbit);
    }
    if (featured_2012_da14) $("#objects-of-interest tr:gt(2)").remove();
    else $("#objects-of-interest tr:gt(1)").remove();
    $("#objects-of-interest")
      .append(featured_html)
      .on("click", "tr", function () {
        $("#objects-of-interest tr").css("background-color", "#000");
        var $e = $(this);
        var full_name = $e.data("full-name");
        $("#sun-selector").css("background-color", "green");
        switch (full_name) {
          case "sun":
            clearLock(true);
            return false;
          case "2012 DA14":
            break;
        }
        clearLock();
        $e.css("background-color", "green");
        $("#sun-selector").css("background-color", "#000");
        setLock(full_name);
        return false;
      });
    $("#objects-of-interest-container").show();
    jed = toJED(new Date());
    if (!asteroids_loaded) asteroids_loaded = true;
    if (using_webgl) createParticleSystem();
    else {
      initSimulation();
      startSimulation();
    }
    if (featured_2012_da14) {
      setLock("earth");
      $("#sun-selector").css("background-color", "black");
      $("#earth-selector").css("background-color", "green");
    }
    if (!first_loaded) {
      animate();
      first_loaded = true;
    }
    $("#loading").hide();
    if (typeof mixpanel !== "undefined") mixpanel.track("simulation started");
  };
  function createParticleSystem() {
    attributes = {
      a: { type: "f", value: [] },
      e: { type: "f", value: [] },
      i: { type: "f", value: [] },
      o: { type: "f", value: [] },
      ma: { type: "f", value: [] },
      n: { type: "f", value: [] },
      w: { type: "f", value: [] },
      P: { type: "f", value: [] },
      epoch: { type: "f", value: [] },
      value_color: { type: "c", value: [] },
      size: { type: "f", value: [] },
      locked: { type: "f", value: [] },
      is_planet: { type: "f", value: [] },
    };
    uniforms = {
      color: { type: "c", value: new THREE.Color(16777215) },
      jed: { type: "f", value: jed },
      earth_i: { type: "f", value: Ephemeris.earth.i },
      earth_om: { type: "f", value: Ephemeris.earth.om },
      planet_texture: {
        type: "t",
        value: loadTexture(opts.static_prefix + "/img/cloud4.png"),
      },
      small_roid_texture: {
        type: "t",
        value: loadTexture(opts.object_texture_path),
      },
      small_roid_circled_texture: {
        type: "t",
        value: loadTexture(opts.static_prefix + "/img/cloud4-circled.png"),
      },
    };
    var vertexshader = document
      .getElementById("vertexshader")
      .textContent.replace("{{PIXELS_PER_AU}}", PIXELS_PER_AU.toFixed(1));
    var particle_system_shader_material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      attributes: attributes,
      vertexShader: vertexshader,
      fragmentShader: document.getElementById("fragmentshader").textContent,
    });
    particle_system_shader_material.depthTest = false;
    particle_system_shader_material.vertexColor = true;
    particle_system_shader_material.transparent = true;
    particle_system_shader_material.blending = THREE.AdditiveBlending;
    for (var i = 0; i < added_objects.length; i++) {
      if (i < planets.length) {
        attributes.size.value[i] = 75;
        attributes.is_planet.value[i] = 1;
      } else {
        attributes.size.value[i] = added_objects[i].opts.object_size;
        attributes.is_planet.value[i] = 0;
      }
      attributes.a.value[i] = added_objects[i].eph.a;
      attributes.e.value[i] = added_objects[i].eph.e;
      attributes.i.value[i] = added_objects[i].eph.i;
      attributes.o.value[i] = added_objects[i].eph.om;
      attributes.ma.value[i] = added_objects[i].eph.ma;
      attributes.n.value[i] = added_objects[i].eph.n || -1;
      attributes.w.value[i] =
        added_objects[i].eph.w_bar ||
        added_objects[i].eph.w + added_objects[i].eph.om;
      attributes.P.value[i] = added_objects[i].eph.P || -1;
      attributes.epoch.value[i] = added_objects[i].eph.epoch;
      attributes.value_color.value[i] = added_objects[i].opts.display_color;
      attributes.locked.value[i] = 0;
    }
    setAttributeNeedsUpdateFlags();
    particleSystem = new THREE.ParticleSystem(
      particle_system_geometry,
      particle_system_shader_material
    );
    window.ps = particleSystem;
    scene.add(particleSystem);
  }
  function setAttributeNeedsUpdateFlags() {
    attributes.value_color.needsUpdate = true;
    attributes.locked.needsUpdate = true;
    attributes.size.needsUpdate = true;
  }
  function starTexture(color, size) {
    var size = size ? parseInt(size * 24) : 24;
    var canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    var col = new THREE.Color(color);
    var context = canvas.getContext("2d");
    var gradient = context.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      0,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width / 2
    );
    var rgbaString =
      "rgba(" +
      ~~(col.r * 255) +
      "," +
      ~~(col.g * 255) +
      "," +
      ~~(col.b * 255) +
      "," +
      1 +
      ")";
    gradient.addColorStop(0, rgbaString);
    gradient.addColorStop(0.1, rgbaString);
    gradient.addColorStop(0.6, "rgba(125, 20, 0, 0.2)");
    gradient.addColorStop(0.92, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }
  function changeJED(new_jed) {
    jed = new_jed;
  }
  function animate() {
    if (!asteroids_loaded) {
      render();
      requestAnimFrame(animate);
      return;
    }
    if (opts.camera_fly_around)
      if (locked_object) {
        var pos = locked_object.getPosAtTime(jed);
        if (featured_2012_da14 && locked_object.name === "Earth")
          cam.position.set(pos[0] - 20, pos[1] + 20, pos[2] + 20);
        else cam.position.set(pos[0] + 25, pos[1] - 25, pos[2] - 70);
        cameraControls.target = new THREE.Vector3(pos[0], pos[1], pos[2]);
      } else setNeutralCameraPosition();
    render();
    requestAnimFrame(animate);
  }
  function render(force) {
    cameraControls.update();
    var now = new Date().getTime();
    if (
      now - display_date_last_updated > 500 &&
      typeof datgui !== "undefined"
    ) {
      var georgian_date = fromJED(jed);
      datgui["Display date"] =
        georgian_date.getMonth() +
        1 +
        "/" +
        georgian_date.getDate() +
        "/" +
        georgian_date.getFullYear();
      display_date_last_updated = now;
    }
    if (using_webgl && (object_movement_on || force)) {
      uniforms.jed.value = jed;
      jed += opts.jed_delta;
    }
    renderer.render(scene, camera);
  }
  var fuzzes = [
    { word: "trillion", num: 1e12 },
    { word: "billion", num: 1e9 },
    { word: "million", num: 1e6 },
  ];
  function fuzzy_price(n) {
    for (var i = 0; i < fuzzes.length; i++) {
      var x = fuzzes[i];
      if (n / x.num >= 1) {
        var prefix = n / x.num;
        if (i == 0 && prefix > 100) return ">100 " + x.word;
        return prefix.toFixed(2) + " " + x.word;
      }
    }
    return n;
  }
  function loadTexture(path) {
    if (
      typeof passthrough_vars !== "undefined" &&
      passthrough_vars.offline_mode
    ) {
      var b64_data = $('img[data-src="' + path + '"]').attr("src");
      var new_image = document.createElement("img");
      var texture = new THREE.Texture(new_image);
      new_image.onload = function () {
        texture.needsUpdate = true;
      };
      new_image.src = b64_data;
      return texture;
    }
    return THREE.ImageUtils.loadTexture(path);
  }
}
if (!window.console) window.console = { log: function () {} };
