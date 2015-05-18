/*!
* @jSlider - a jQuery Plugin
* @version 1.0.0
*
* @author Thuy Nguyen ducthuy@gmail.com
* @github https://github.com/copthuy/jSlider
* MIT License
* Copyright (c) 2015 Thuy Nguyen
*/

(function(factory) {
	if (typeof define === 'function'
		&& define.amd
		&& define.amd.jQuery) {
		
		// AMD. Register as anonymous module.
        define(['jquery'], factory);

    } else if (typeof jQuery !== 'undefined') {
        // Browser globals.
        factory(jQuery);

    }

})(function($) {
	"use strict";

	/* global touching environment variables */
	var isTouch = 'ontouchstart' in window
		, isPointerIE10 = (window.navigator.msPointerEnabled && !window.navigator.pointerEnabled) || false
		, isPointer = window.navigator.pointerEnabled || window.navigator.msPointerEnabled || false
		, isTouchDevice = isTouch || isPointer;

	var startEvent = isTouchDevice ? (isPointer ? (isPointerIE10 ? 'MSPointerDown' : 'pointerdown') : 'touchstart') : 'mousedown'
		, moveEvent = isTouchDevice ? (isPointer ? (isPointerIE10 ? 'MSPointerMove' : 'pointermove') : 'touchmove') : 'mousemove'
		, stopEvent = isTouchDevice ? (isPointer ? (isPointerIE10 ? 'MSPointerUp' : 'pointerup') : 'touchend') : 'mouseup'
		, enterEvent = isTouchDevice ? null : 'mouseenter'
		, leaveEvent = isTouchDevice ? null : 'mouseleave'
		, cancelEvent = isTouchDevice ? (isPointer ? (isPointerIE10 ? 'MSPointerCancel' : 'pointercancel') : 'touchcancel') : null

	var sliderMap = []
		, isTouching = false
		, isSwiping = false
		, swipeThreshold = 35
		, startX = 0
		, startY = 0
		, deltaX = 0
		, deltaY = 0
		, activeSlider;

	var body = document.body || document.documentElement, css = body.style;
	var isCSSAnimation = (css.transform !== undefined
						|| css.WebkitTransform !== undefined
						|| css.MozTransform !== undefined
						|| css.MsTransform !== undefined
						|| css.OTransform !== undefined)
						&&
						(css.transition !== undefined
						|| css.WebkitTransition !== undefined
						|| css.MozTransition !== undefined
						|| css.MsTransition !== undefined
						|| css.OTransition !== undefined);

	/* common functions */
	function getX(evt) {
		var event = evt.originalEvent ? evt.originalEvent : evt;

		if (isTouch && event.touches !== undefined && event.touches.length == 1) {
			return event.touches[0].pageX;
		} else if (evt.pageX !== undefined) {
			return evt.pageX;
		} else if (event.pageX !== undefined) {
			return event.pageX;
		}
		
		return 0;
	}

	function getY(evt) {
		var event = evt.originalEvent ? evt.originalEvent : evt;

		if (isTouch && event.touches !== undefined && event.touches.length == 1) {
			return event.touches[0].pageY;
		} else if (evt.pageY !== undefined) {
			return evt.pageY;
		} else if (event.pageY !== undefined) {
			return event.pageY;
		}
		
		return 0;
	}

	/* lib extension */
	$.fn.extend({

		'setTransition': function(time) {
			if (isCSSAnimation == true) {
				var timing = time !== 0 ? 'cubic-bezier(0.39, 0.575, 0.565, 1)' : 'linear'
					, duration = time + 's'
					, property = time !== 0 ? 'all' : 'none';
				
				this.css({
					'-webkit-transition-property': property
					, '-moz-transition-property': property
					, '-ms-transition-property': property
					, '-o-transition-property': property
					, 'transition-property': property

					, '-webkit-transition-duration': duration
					, '-moz-transition-duration': duration
					, '-ms-transition-duration': duration
					, '-o-transition-duration': duration
					, 'transition-duration': duration
					
					, '-webkit-transition-timing-function': timing
					, '-moz-transition-timing-function': timing
					, '-ms-transition-timing-function': timing
					, '-o-transition-timing-function': timing
					, 'transition-timing-function': timing
				});
			}

			return this;
		}

		, 'translateX': function(val, noanim) {
			var surfix = '';
			if (val.toString().indexOf('px') == -1) {
				surfix = 'px';
			}

			if (isCSSAnimation == true) {
				if (noanim !== undefined && noanim !== null && noanim === true) {
					this.setTransition(0);
				}
				this.css({
					'-webkit-transform': 'translate3d(' + val + surfix + ', 0, 0)'
					, '-moz-transform': 'translateX(' + val + surfix + ')'
					, '-ms-transform': 'translateX(' + val + surfix + ')'
					, '-o-transform': 'translateX(' + val + surfix + ')'
					, 'transform': 'translateX(' + val + surfix + ')'
				});
			
			} else {
				this.css({
					'margin-left': val
				});
			}

			return this;
		}

		, 'animateX': function(val, time) {
			if (isCSSAnimation == true) {
				this
					.setTransition(time / 1000)
					.translateX(val);

				if (!this.hasClass('event-attached')) {
					this
						.addClass('event-attached')
						.on('transitionend webkitTransitionEnd oTransitionEnd msTransitionEnd', function(evt) {
							var $this = $(evt.target);
							if ($this.hasClass('slider-slides')) {
								$this.getSlider().slideComplete();
								$this.setTransition(0);
							}
						});
				}
			
			} else {
				this
					.stop(true, true)
					.animate({
							'margin-left': val
						}
						, time
						, function() {
							$(this).getSlider().slideComplete();
						});
			}

			return this;
		}

		, 'animateFade': function(time) {
			if (isCSSAnimation == true) {
				this
					.setTransition(time / 1000)
					.css({
						'-webkit-opacity': 1
						, '-moz-opacity': 1
						, '-ms-opacity': 1
						, '-o-opacity': 1
						, 'opacity': 1
					});

				if (!this.hasClass('event-attached')) {
					this
						.addClass('event-attached')
						.on('transitionend webkitTransitionEnd oTransitionEnd msTransitionEnd', function() {
							$(this).getSlider().slideComplete();
						});
				}
			
			} else {
				this
					.stop(true, true)
					.fadeTo(time
						, 1
						, function() {
							$(this).getSlider().slideComplete();
						});
			}

			return this;
		}
	});

	/* extend slider to DOM object */
	$.fn.extend({
		
		/* setup slider */
		'sliderInit': function(options) {

			/* do nothing if there is only one slide */
			var total = this.children().length;
			if (total <= 1 || this.data('initialized') == true) {
				return;
			}
			if (!this.hasClass('jSlider')) {
				this.addClass('jSlider');
			}

			/* SLIDER SETTINGS */
			/* ------------------------------------------------------------------------------------------*/
			var defaults = {
				'navigation': 'hover'
				, 'indicator': 'always'
				, 'speed': 500
				, 'delay': 5000
				, 'transition': 'slide'
				, 'loop': false
				, 'group': 1
			};

			var html_data = {
				'navigation': this.data('navigation')
				, 'indicator': this.data('indicator')
				, 'speed': this.data('speed')
				, 'delay': this.data('delay')
				, 'transition': this.data('transition')
				, 'loop': this.data('loop')
				, 'group': this.data('group')
			}

			/* extend settings */
			var settings = $.extend({}, defaults, html_data, options);
			
			/* fixes */
			if (isNaN(settings.speed)
				|| settings.speed < 0) {

				settings.speed = defaults.speed;
			}
			if (isNaN(settings.delay)
				|| settings.delay < 0) {

				settings.delay = defaults.delay;
			}
			if (settings.transition != 'slide'
				&& settings.transition != 'fade') {

				settings.transition = defaults.transition;
			}
			if (settings.transition != 'slide') {
				settings.group = 1;
			}
			if (isTouchDevice) {
				if (settings.navigation == 'hover') {
					settings.navigation = 'none';
				}
				if (settings.indicator == 'hover') {
					settings.indicator = 'none';
				}
			}
			total = Math.ceil(total / settings.group);
			
			
			/* save settings */
			this.data('settings', settings);


			/* GET THE START UP DATA */
			/* ------------------------------------------------------------------------------------------*/
			var current = 0
				, selected = '> div.selected';
			
			/* hash tag is in top priority */
			if (window.location.hash != '') {
				selected = window.location.hash + ',' + selected
			}

			/* if found selected item, store the index & update class */
			if (this.find(selected).length != 0) {
				current = Math.ceil(this.find(selected).index() / settings.group);
				
				/* update class */
				this.find('> div.selected').removeClass('selected');
				this.find('> div:eq(' + current + ')').addClass('selected');

			}

			/* SETUP ANIMATION */
			this.find('[class*=appear-]').each(function() {
				var $elem = $(this)
					, top = parseInt($elem.css('top'), 10)
					, left = parseInt($elem.css('left'), 10);

				$elem
					.data('top', top)
					.data('left', left);

				if ($elem.hasClass('appear-top')) {
					$elem.css('top', top - 15);
				}
				if ($elem.hasClass('appear-bottom')) {
					$elem.css('top', top + 15);
				}
				if ($elem.hasClass('appear-left')) {
					$elem.css('left', top - 15);
				}
				if ($elem.hasClass('appear-right')) {
					$elem.css('left', left + 15);
				}
				$elem.css('opacity', 0);

				if (isCSSAnimation) {
					$elem.addClass('cssAnimation');
				}
			});

			
			/* SETUP DATA */
			/* ------------------------------------------------------------------------------------------*/
			this.data('total', total)
				.data('current', current)
				.data('cancel-play', false)
				.data('map-index', sliderMap.length)
				.data('initialized', true)
				.wrapInner('<div class="slider-content"><div class="slider-content-wrapper"><div class="slider-slides"></div></div></div>');
			this.find('.slider-slides').setTransition(0);

			/* SAVE TO MAP */
			sliderMap.push({
				'slider': this
				, 'sliderInterval': null
				, 'showInterval': null
			});

			/* calculate group */
			if (settings.group != 1) {
				this.find('.slider-slides > div').css('width', 100 / settings.group + '%');
			} else {
				this.find('img:eq(0)').clone().prependTo(this);
			}

			/* FIX DOM */
			if (isPointerIE10 || isPointer) {
				this.css({
					'-ms-scroll-chaining': 'none'
					, '-ms-touch-action': 'pan-y pinch-zoom'
					, 'touch-action': 'pan-y pinch-zoom'
				});
			}

			if (isTouch) {
				this.addClass('webkit-slider');
			}
			if (settings.transition == 'fade' && (settings.navigation != 'none' || settings.indicator != 'none')) {
				this.addClass('fade-transition');
			} else if (settings.navigation == 'none' && settings.indicator == 'none') {
				this.addClass('background-transition');
			}

			
			/* BINDING EVENTS */
			/* ------------------------------------------------------------------------------------------*/
			if (settings.navigation != 'none' || settings.indicator != 'none') {
				this.find('.slider-content-wrapper').on(startEvent, function(evt) {
					var $slider = $(this).getSlider()
						, $slides = $slider.find('.slider-slides');

					if (!isTouchDevice) {
						evt.preventDefault();
						
						/* change cursor */
						$slides.addClass('grabbing');
					}
					$slides.setTransition(0);

					/* reset touch status */
					isTouching = true;
					isSwiping = false;

					/* start capture first mouse / finger point position */
					startX = getX(evt);
					startY = getY(evt);

					/* cancel autoplay */
					$slider.sliderStop();
					activeSlider = $slider;

				}).on(moveEvent, function(evt) {
					var $slider = $(this).getSlider()
						, $slides = $slider.find('.slider-slides')
						, settings = $slider.data('settings')
						, current = $slider.data('current')
						, w = $slider.width();

					/* on desktop, keep firing mouse move event if not drag */
					if (isTouching != true) {
						return;
					}
					

					/* if on desktop, cancel other events */
					if (!isTouchDevice) {
						evt.preventDefault();
					}

					/* capture new mouse / finger point position */
					deltaX = getX(evt) - startX;
					deltaY = getY(evt) - startY;

					/* on mobile, the vertical swipe distance is bigger, assume this is page scroll	*/
					if (Math.abs(deltaY) > Math.abs(deltaX)) {
						if (isTouchDevice) {
							$slider.sliderCancelTouch();
						}
						return;
					}
					
					/* if this is swipe & drag, set swipe on and recalculate the slider-slides */
					isSwiping = true;
					evt.preventDefault();

					if (settings.transition == 'slide') {
						$slides.translateX(- current * w + deltaX, true);
					}


				}).on(stopEvent + ' ' + cancelEvent, function(evt) {
					var $slider = $(this).getSlider()
						, $slides = $slider.find('.slider-slides')
						, settings =$slider.data('settings')
						, current = $slider.data('current')
						, w = $slider.width()
						, dir = 1;
					
					/* change cursor */
					$slides.removeClass('grabbing');

					/* finish the touch swipe by moving to the next / previous slider */
					if (Math.abs(deltaX) > swipeThreshold) {
						if (deltaX > 0) {
							dir = -1;
						} else {
							dir = 1;
						}
						$slider.sliderGo(dir);

					} else if (settings.transition == 'slide') {

						/* if not wipe enough, stay at the current slider */
						$slider.sliderUpdate(current);
					}

					/* restore default values */
					$slider.sliderCancelTouch();
					activeSlider = null;
				});

				$(document).on({
					'mouseup': function(evt) {
						if (activeSlider != null) {
							activeSlider.find('.slider-content-wrapper').trigger(stopEvent);
						}
					}
				});
				
				/* SHOW NAV / INDICATOR */
				/* ------------------------------------------------------------------------------------------*/
				if (enterEvent != null && leaveEvent != null) {
					this.on(enterEvent, function() {
						var $slider = $(this)
							, settings = $slider.data('settings');
						if (settings.navigation == 'hover') {
							$slider.find('.navigator').fadeIn();
						}
						if (settings.indicator == 'hover') {
							$slider.find('.indicator').fadeIn();
						}

					}).on(leaveEvent, function() {
						var $slider = $(this)
							, settings = $slider.data('settings');
						if (settings.navigation == 'hover') {
							$slider.find('.navigator').fadeOut();
						}
						if (settings.indicator == 'hover') {
							$slider.find('.indicator').fadeOut();
						}
					});
				}
			}
			

			/* ADD CONTROLLER */
			/* ------------------------------------------------------------------------------------------*/
			var controller = $('<div />', {
				'class': 'controller'
				, 'html': '<div class="navigator"><span class="prev" data-direction="-1">Previous</span><span class="next" data-direction="1">Next</span></div>'
						+ '<div class="indicator"></div>'
			}).appendTo(this);
			if (navigator.userAgent.toLowerCase().indexOf('msie 8') != -1) {
				controller.addClass('msie8');
			}

			/* navigator */
			var nav = this.find('.navigator')
				, ind = this.find('.indicator');

			if (settings.navigation == 'always') {
				nav.show();
			}
			this
				.find('.navigator span')
				.on('click', function(evt) {
					evt.preventDefault();
					$(this).getSlider()
						.sliderStop()
						.sliderGo($(this).data('direction'));
				});
			

			/* indicator */
			if (settings.indicator == 'always') {
				ind.show();
			}

			for (var i = 0; i < total; i++) {
				$('<span />', {
					'class': (i == current ? 'selected' : '')
					, 'text': i
					, 'data-slide': i
				})
				.appendTo(controller.find('.indicator'))
				.on('click', function(evt) {
					evt.preventDefault();
					var $this = $(this)
						, slider = $this.getSlider()
						, current = slider.data('current')
						, next = $this.data('slide');

					if (next < 0 || next >= slider.data('total')) {
						next = current;
					}

					slider
						.sliderStop()
						.sliderOptimize(current, next)
						.sliderUpdate(next);
				});
			}

			/* UPDATE SIZE & SELECTED INDEX */
			/* ------------------------------------------------------------------------------------------*/
			/* fire event for addition plugins */
			this.trigger({
				'type': 'slideCreated'
			});

			this
					.sliderResized()
					.sliderUpdate(current)
					.sliderOptimize()
					.sliderPlay();

			return this;
		}

		, 'sliderPlay': function() {
			var current = this.data('current')
				, index = this.data('map-index')
				, settings = this.data('settings')
				, total = this.data('total')
				, stop = this.data('cancel-play')
				, isLoaded = this.data('imageLoaded') == this.data('totalImages');
			
			if (current >= total - 1) {
				this.sliderStop();
				return;
			}
			if (stop == true || settings.delay == 0) {
				return;
			}

			var $slider = this;
			sliderMap[index]['sliderInterval'] = setInterval(function() {
				var stop = $slider.data('cancel-play');
				if (stop == true) {
					clearInterval(sliderMap[index]['sliderInterval']);
					return;
				}
				if (isLoaded) {
					$slider.sliderGo(1);
				}
			}, settings.delay);
		}

		, 'sliderStop': function() {
			var index = this.data('map-index');
			clearInterval(sliderMap[index]['sliderInterval']);

			if (this.data('cancel-play') == true) {
				return this;
			}

			return this.data('cancel-play', true).trigger('slideCancelAutoPlay');
		}

		, 'slideComplete': function() {

			/* fire event for addition plugins */
			return this.sliderOptimize().trigger({
				'type': 'slideComplete'
				, 'current': this.data('current')
			});
		}

		, 'sliderOptimize': function(prev, next) {
			var settings = this.data('settings')
				, current = this.data('current')
				, p1 = prev !== undefined ? prev : current
				, p2 = next !== undefined ? next : current
				, $elems = this.find('.slider-slides > div');

			if (settings.transition == 'slide') {
				return this.sliderShowItems();		
			}

			/* hide un-use slide */
			for (var i = 0; i < $elems.length; i++) {
				if (p2 != i) {
					$elems.eq(i).css({
						'-webkit-transition-duration': 0
						, '-moz-transition-duration': 0
						, '-ms-transition-duration': 0
						, '-o-transition-duration': 0
						, 'transition-duration': 0

						, '-webkit-opacity': 0
						, '-moz-opacity': 0
						, '-ms-opacity': 0
						, '-o-opacity': 0
						, 'opacity': 0
						, 'z-index': 0
					});
				}
			}
			
			return this.sliderShowItems();
		}

		, 'sliderCancelTouch': function() {
			/* restore default values */
			startX = 0;
			startY = 0;
			deltaX = 0;
			deltaY = 0;
			isTouching = false;
			isSwiping = false;

			return this;
		}
		
		/* update slider dimension */
		, 'sliderResized': function() {
			var i
				, settings = this.data('settings')
				, total = this.data('total')
				, current = this.data('current')
				, w = this.width()
				, $elems = this.find('.slider-slides > div');
			
			/* update elements */
			for (i = 0; i < $elems.length; i++) {
				if (settings.transition == 'slide') {
					$elems.eq(i).css('left', w * i / settings.group);
				} else if (settings.transition == 'fade') {
					$elems.eq(i).css('z-index', total - i);
					if (i == current) {
						$elems.eq(i).css('z-index', total);
					}
				}
			}
			
			/* update container & slider-slides */
			if (settings.transition == 'slide') {
				this.find('.slider-slides')
					.translateX(- current * w, true);
			}

			/* re-chain */
			return this;
		}

		, 'sliderGo': function(direction) {
			var settings = this.data('settings')
				, current = this.data('current')
				, total = this.data('total');
			var next = current + direction;

			if (next < 0 || next >= total) {
				if (settings.loop == false) {
					next = current;
				} else {
					if (next < 0) {
						next = total - 1;
					} else {
						next = 0;
					}
				}
			}

			return this
					.sliderOptimize(current, next)
					.sliderUpdate(next);
		}

		, 'sliderUpdate': function(current) {
			if (this.data('current') != current) {
				/* fire event for addition plugins */
				this.trigger({
					'type': 'slideStart'
				});
			}

			var w = this.width()
				, settings = this.data('settings');

			/* move sliders */
			this.data('current', current);
			if (settings.transition == 'slide') {
				this
					.find('.slider-slides')
					.animateX(- current * w, settings.speed);
			} else if (settings.transition == 'fade') {
				this
					.find('.slider-slides > div:eq(' + current + ')')
					.css('z-index', this.data('total'))
					.animateFade(settings.speed);
			}

			/* update navigator */
			this.find('.navigator span').removeClass('disabled');
			if (settings.loop == false) {
				if (current == 0) {
					this.find('.navigator .prev').addClass('disabled');

				} else if (current == this.data('total') - 1) {
					this.find('.navigator .next').addClass('disabled');

				}
			}

			/* update indicator */
			this.find('.indicator span.selected').removeClass('selected');
			this.find('.indicator span:eq(' + current + ')').addClass('selected');

			/* re-chain */
			return this;
		}

		, 'sliderShowItems': function() {
			var $slider = this
				, current = $slider.data('current')
				, index =  $slider.data('map-index')
				, $elems = $slider.find('.slider-slides > div:eq(' + current + ') [class*=appear-]')
				, showIndex = 0; 

			$slider.sliderHideItems();
			clearInterval(sliderMap[index]['showInterval']);
			if ($elems.length <= 0) {
				return $slider;
			}

			sliderMap[index]['showInterval'] = setInterval(function() {
				if (showIndex >= $elems.length) {
					clearInterval(sliderMap[index]['showInterval']);
					return $slider;
				}
				var $item = $elems.eq(showIndex);
				if (isCSSAnimation) {
					$item.css({
						'top': $item.data('top')
						, 'left': $item.data('left')
						, 'opacity': 1
					});
				} else {
					$item.stop(true, true).animate({
						'top': $item.data('top')
						, 'left': $item.data('left')
						, 'opacity': 1
					}, 500);
				}
				showIndex++;
			}, 200);

			return $slider;
		}

		, 'sliderHideItems': function() {
			var current = this.data('current')
				, index =  this.data('map-index');

			clearInterval(sliderMap[index]['showInterval']);
			this.find('.slider-slides > div:not(:eq(' + current + ')) [class*=appear-]').each(function() {
				var $elem = $(this)
					, top = $elem.data('top')
					, left = $elem.data('left');

				if ($elem.hasClass('appear-top')) {
					$elem.css('top', top - 15);
				}
				if ($elem.hasClass('appear-bottom')) {
					$elem.css('top', top + 15);
				}
				if ($elem.hasClass('appear-left')) {
					$elem.css('left', top - 15);
				}
				if ($elem.hasClass('appear-right')) {
					$elem.css('left', left + 15);
				}
				$elem.css('opacity', 0);
			});

			return this;
		}

		, 'getSlider': function() {
			if (this.hasClass('jSlider')) {
				return this;
			}
			return this.parents('.jSlider');
		}
	});
	
	/* startup functions */
	$(document).ready(function(evt) {
		$('body .jSlider').each(function() {
			$(this).sliderInit();
		});
	});

	$(window).resize(function(evt) {
		$('body .jSlider').each(function() {
			$(this).sliderResized();
		});
	});

});

