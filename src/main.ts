import {
  makeLinear,
  makePromise,
  polarToRectangular,
  sleep,
} from "phil-lib/misc";
import "./style.css";

const svg = document.querySelector("svg")!;

// TODO stop copying this and move it to phil-lib.
class AnimationLoop {
  constructor(private readonly onWake: (time: DOMHighResTimeStamp) => void) {
    this.callback = this.callback.bind(this);
    this.callback(performance.now());
  }
  #cancelled = false;
  cancel() {
    this.#cancelled = true;
  }
  private callback(time: DOMHighResTimeStamp) {
    if (!this.#cancelled) {
      requestAnimationFrame(this.callback);
      this.onWake(time);
    }
  }
}

/**
 * A Wave object represents a single peak.
 */
class Wave {
  /**
   * This is the ideal distance from the peak of one wave to the peak of the next.
   * When I do this the effect looks like a continuous sine wave, rotated about the center.
   * When the Wave objects are too spread apart they look a little fuzzy on the edges.
   */
  static readonly OFFSET = 35;
  /**
   * This is the top level SVG object for each Wave.
   */
  readonly #group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  /** Modify this object to _efficiently_ change the transform attribute of the #group. */
  readonly #transform = this.#group.transform.baseVal.initialize(
    svg.createSVGTransform()
  );
  /**
   * The dark part of the wave, most visible below and to the right of each peak.
   */
  readonly #shadow = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  /**
   * The bright part of the wave, most visible above and to the left of each peak.
   */
  readonly #highlight = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  /**
   * Use this as the wave spreads out to show that that wave is less strong.
   * 0 means show nothing.  1 means show it as strong as possible.
   */
  set opacity(newValue: number) {
    this.#group.style.opacity = newValue.toString();
  }
  /**
   * Remove this Wave from the GUI.
   */
  remove(): void {
    this.#group.remove();
  }
  /**
   * Create and display a new Wave.
   * @param radius The distance from the center of wave (the center of the circle) to the peak of the wave (the highest point).
   */
  constructor(radius: number) {
    const group = this.#group;
    const shadow = this.#shadow;
    const highlight = this.#highlight;
    svg.appendChild(group);
    group.appendChild(shadow);
    group.appendChild(highlight);
    group.classList.add("group-top");
    const offsetFromCenter = 5;
    shadow.cx.baseVal.value = offsetFromCenter;
    shadow.cy.baseVal.value = offsetFromCenter;
    highlight.cx.baseVal.value = -offsetFromCenter;
    highlight.cy.baseVal.value = -offsetFromCenter;
    this.radius = radius;
  }
  /**
   * The distance from the center of wave (the center of the circle) to the peak of the wave (the highest point).
   */
  get radius(): number {
    return this.#shadow.r.baseVal.value;
  }
  set radius(newValue) {
    this.#shadow.r.baseVal.value = newValue;
    this.#highlight.r.baseVal.value = newValue;
  }
  /**
   * Move the Wave.
   * @param x How far from the left of the document to the center of the wave, measured in CSS pixels.
   * @param y How far from the top of the document to the center of the wave, measured in CSS pixels.
   * Note that the wave is attached to the document, not the viewport.  So when you scroll the document
   * the Wave objects will scroll with it.
   */
  setPosition(x: number, y: number) {
    this.#transform.setTranslate(x, y);
  }
  /**
   * Create a new wave and animate it.  The wave will start very small obvious.  Over time it
   * will spread out and get thinner.  Eventually it will fade away completely and get garbage
   * collected.
   * @param x How far from the left of the document to the center of the wave, measured in CSS pixels.
   * @param y How far from the top of the document to the center of the wave, measured in CSS pixels.
   * Note that the wave is attached to the document, not the viewport.  So when you scroll the document
   * the Wave objects will scroll with it.
   * @returns A promise that will be fulfilled when this Wave is big enough to add the next Wave
   * inside.
   */
  static start(x: number, y: number) {
    const wave = new this(0);
    wave.setPosition(x, y);
    const startTime = performance.now();
    const endTime = startTime + 10000;
    const radius = makeLinear(startTime, 0, endTime, 800);
    const opacity = makeLinear(startTime, 1, endTime, 0);
    const animationLoop = new AnimationLoop((time) => {
      if (time > endTime) {
        wave.remove();
        animationLoop.cancel();
      } else {
        wave.radius = radius(time);
        wave.opacity = opacity(time);
      }
    });
    return sleep(500);
  }
  /**
   * This will create a series of Wave animations.
   */
  static async follow() {
    /**
     * Current position of the mouse.  Measured in CSS pixels relative to the top left of the page.
     */
    let mouseX = NaN;
    /**
     * Current position of the mouse.  Measured in CSS pixels relative to the top left of the page.
     */
    let mouseY = NaN;
    /**
     * Don't start doing anything until we know where the mouse it.
     */
    const start = makePromise();
    document.body.addEventListener("mousemove", (ev) => {
      // This is ugly.  JavaScript doesn't let you ask for the mouse position any time you want.
      // It only gives it to you in mouse events, so I have to track them and keep save the
      // current position myself.
      // Warning:  This does not work if you use the mousewheel (or two fingers on the track
      // pad) to scroll.
      mouseX = ev.pageX;
      mouseY = ev.pageY;
      start.resolve();
    });
    await start.promise;
    /**
     * Remember where we drew the effect last time.  _Initially_ the
     * mouse and the effect are right on top of each other.  If the mouse moves too quickly we'll use
     * this to slow down our effect and eventually catch up to the mouse.
     */
    let previousX = mouseX;
    /**
     * Remember where we drew the effect last time.  _Initially_ the
     * mouse and the effect are right on top of each other.  If the mouse moves too quickly we'll use
     * this to slow down our effect and eventually catch up to the mouse.
     */
    let previousY = mouseY;
    while (true) {
      let x = mouseX;
      let y = mouseY;
      const proposedDistance = Math.hypot(x - previousX, y - previousY);
      const maxStep = this.OFFSET * 2;
      if (proposedDistance > maxStep) {
        // Move in the direction that the mouse is, but only move the maximum allowed amount.
        const θ = Math.atan2(x - previousX, y - previousY);
        const newOffset = polarToRectangular(maxStep, θ);
        x = previousX + newOffset.x;
        y = previousY + newOffset.y;
      }
      previousX = x;
      previousY = y;
      // Draw a Wave then sleep a short time.
      await this.start(x, y);
    }
  }
}

Wave.follow();
