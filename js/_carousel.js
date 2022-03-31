/*!
 * @_carousel
 * @version 2.0.0
 *
 * @author Thuy Nguyen ducthuy@gmail.com
 * @github https://github.com/copthuy/_carousel
 * MIT License
 * Copyright (c) 2022 Thuy Nguyen
 */
"use strict";

const TYPE_NUMBER = "[object number]";
const TYPE_REGEX = "[object RegExp]";
const NULL_REGEX = /^(0|false|no|off|null)$/i;

const IS_TOUCH = "ontouchstart" in window;
const ON_START = IS_TOUCH ? "touchstart" : "mousedown";
const ON_MOVE = IS_TOUCH ? "touchmove" : "mousemove";
const ON_STOP = IS_TOUCH ? "touchend" : "mouseup";
const ON_CANCEL = IS_TOUCH ? "touchcancel" : null;
const ON_ENTER = IS_TOUCH ? null : "mouseenter";
const ON_LEAVE = IS_TOUCH ? null : "mouseleave";
const ON_TRANSITION_END = "transitionend";

class _carousel {
	interval;
	pause = false;
	index = 0;
	dispatched = false;
	x;
	y;

	constructor(domnode) {
		this.carousel = domnode;
		this.content = domnode.querySelector("._carousel-content");
		this.items = this.content ? [...this.content.children] : [];

		this.options = {
			controls: this.data("controls", NULL_REGEX),
			indicators: this.data("indicators", NULL_REGEX),
			delay: this.data("delay", 5000),
		};
		this.autoplay = this.options.delay > 1000;

		this.init();
	}

	dispatch(name, detail = null) {
		const evt = new CustomEvent(name, {
			detail: detail,
		});
		this.carousel.dispatchEvent(evt);
	}

	data(name, ref = "") {
		const attr = this.carousel.getAttribute("data-" + name) || ref;
		const type = Object.prototype.toString.call(ref);

		return type == TYPE_NUMBER
			? Number(attr)
			: type == TYPE_REGEX
			? !NULL_REGEX.test(attr)
			: attr;
	}

	pointer(evt, val) {
		const event = evt.originalEvent ? evt.originalEvent : evt;

		return IS_TOUCH &&
			event.touches !== undefined &&
			event.touches.length == 1
			? event.touches[0][val]
			: evt[val] !== undefined
			? evt[val]
			: event[val] !== undefined
			? event[val]
			: 0;
	}

	cycle(val) {
		return (val + this.items.length) % this.items.length;
	}

	button(value) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.value = value;
		btn.addEventListener("click", (evt) => {
			evt.preventDefault();
			let elem = evt.currentTarget;
			let parent_class = elem.parentNode.className;
			let current_value = Number(elem.value);
			this.go(
				/indicators/.test(parent_class)
					? current_value
					: this.index + current_value
			);
		});
		return btn;
	}

	controls() {
		if (this.options.controls) {
			let nav = document.createElement("nav");
			nav.className = "_carousel-controls";
			this.carousel.appendChild(nav);

			[-1, 1].forEach((i) => {
				nav.appendChild(this.button(i));
			});
		}
	}

	indicators() {
		if (this.options.indicators) {
			let indicator = document.createElement("nav");
			indicator.className = "_carousel-indicators";
			this.carousel.appendChild(indicator);

			for (let i = 0; i < this.items.length; i++) {
				indicator.appendChild(this.button(i));
			}
		}
	}

	video(play = true) {
		const video = this.carousel.querySelector(".selected video");
		if (video) {
			if (play == true) {
				video.play();
			} else {
				video.pause();
			}
		}
	}

	resume() {
		this.stop();
		if (this.autoplay == true) {
			this.interval = setInterval(() => {
				if (this.pause === false) {
					this.go(this.index + 1);
				}
			}, this.options.delay);
		}
	}

	play() {
		if (this.autoplay == true) {
			this.carousel.addEventListener(ON_ENTER, () => {
				this.pause = true;
				this.stop();
			});

			this.carousel.addEventListener(ON_LEAVE, () => {
				if (this.pause == true) {
					this.pause = false;
					this.resume();
				}
			});

			this.resume();
		}
	}

	stop() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}

		this.video(false);
	}

	go(next, start = true) {
		this.video(false);
		this.items.forEach((el, idx) => {
			if (idx == this.cycle(next)) {
				el.classList.add("next");
			} else if (idx != this.index) {
				el.removeAttribute("class");
				el.removeAttribute("style");
			}
		});
		this.carousel.classList.remove("move-left", "move-right");
		this.carousel.classList.add(
			this.index == next
				? ""
				: this.index < next
				? "move-left"
				: "move-right"
		);

		if (start == true) {
			this.dispatched = false;
			this.dispatch("before-transition");
			this.carousel.classList.add("start");
		}
	}

	select() {
		this.items.forEach((el, idx) => {
			el.classList.toggle("selected", idx == this.index);
		});
		this.carousel
			.querySelectorAll("._carousel-indicators button")
			.forEach((el) => {
				el.classList.toggle("selected", Number(el.value) == this.index);
			});

		this.video();
	}

	transition_end(evt) {
		/* ignore inner slide transition end event */
		if (!evt.target.parentElement.classList.contains("_carousel-content")) {
			return;
		}

		/* update class / style attribute */
		this.items.forEach((el, idx) => {
			if (
				el.classList.contains("next") &&
				!this.carousel.classList.contains("drag-null")
			) {
				this.index = idx;
			}
			el.removeAttribute("class");
			el.removeAttribute("style");
		});
		this.carousel.classList.remove(
			"start",
			"drag-null",
			"move-left",
			"move-right"
		);

		/* set selected slide */
		this.select();

		/* dispatch transition end only one time */
		if (this.dispatched == false) {
			this.dispatch("transition-end", this.index);
			this.dispatched = true;
		}
	}

	is_dragging() {
		return this.content.classList.contains("grabbing");
	}

	drag_start(evt) {
		if (!IS_TOUCH) {
			evt.preventDefault();
		}
		this.stop();
		this.content.classList.add("grabbing");

		this.x = this.pointer(evt, "pageX");
		this.y = this.pointer(evt, "pageY");

		/* dispatch event drag start */
		this.dispatch("drag-start");
	}

	drag(evt) {
		if (this.is_dragging()) {
			let delta_x = this.pointer(evt, "pageX") - this.x;
			let delta_y = this.pointer(evt, "pageY") - this.y;
			let next = this.index + (delta_x > 0 ? -1 : 1);
			let scale = Math.abs(delta_x) / this.carousel.offsetWidth;

			/* on mobile, the vertical swipe distance is bigger, assume this is page scroll	*/
			if (IS_TOUCH && Math.abs(delta_y) > Math.abs(delta_x)) {
				this.drag_stop();
				this.resume();
				return;
			}

			/* only update relative slides order and position */
			this.go(next, false);

			/* dragging handle triggers only if the movement is at least 10% */
			this.carousel.classList.toggle("drag-null", scale < 0.1);

			/* update slides css transition */
			this.items.forEach((el, idx) => {
				if (/fade|no-transition/.test(this.carousel.className)) {
					if (idx == this.cycle(next)) {
						el.style.opacity = scale;
					}
				} else if (/parallax/.test(this.carousel.className)) {
					if (idx == this.cycle(next)) {
						el.style.transform = "translateX(" + delta_x + "px)";
					}
					if (idx == this.index) {
						el.style.transform =
							"translateX(" + delta_x * 20 / 100 + "px)";
					}
				} else {
					if (idx == this.cycle(next) || idx == this.index) {
						el.style.transform = "translateX(" + delta_x + "px)";
					}
				}
			});

			/* dispatch event drag move */
			this.dispatch("drag-move", delta_x);
		}
	}

	drag_stop() {
		this.content.classList.remove("grabbing");
	}

	drag_end() {
		if (this.is_dragging()) {
			this.drag_stop();
			this.dispatched = false;
			this.dispatch("before-transition");
			this.dispatch("drag-end");
			this.carousel.classList.add("start");
		}
	}

	init() {
		this.carousel.classList.add("_carousel");
		if (!this.content || this.items.length < 2) {
			return;
		}

		/* update the first index if set */
		this.items.forEach((el, idx) => {
			if (el.classList.contains("selected")) {
				this.index = idx;
			}
		});

		/* add controls */
		this.controls();
		this.indicators();
		this.select();

		/* add events */
		this.content.addEventListener(ON_TRANSITION_END, (evt) =>
			this.transition_end(evt)
		);
		this.content.addEventListener(ON_START, (evt) => this.drag_start(evt));
		this.content.addEventListener(ON_MOVE, (evt) => this.drag(evt));
		this.content.addEventListener(ON_STOP, () => this.drag_end());
		this.content.addEventListener(ON_CANCEL, () => this.drag_end());
		document.addEventListener(ON_STOP, () => this.drag_end());

		/* start auto play */
		this.play();

		/* dispatch event init */
		this.dispatch("init");
	}
}

/* auto start */
[...document.getElementsByClassName("_carousel")].forEach((el) => {
	new _carousel(el);
});
