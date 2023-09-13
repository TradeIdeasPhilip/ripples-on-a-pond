import { makeLinear, makePromise, polarToRectangular, sleep } from "phil-lib/misc";
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

class Wave {
  static readonly OFFSET = 35;
  readonly #group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  readonly #transform = this.#group.transform.baseVal.initialize(
    svg.createSVGTransform()
  );
  readonly #shadow = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  readonly #highlight = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle"
  );
  set opacity(newValue: number) {
    this.#group.style.opacity = newValue.toString();
  }
  remove(): void {
    this.#group.remove();
  }
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
  get radius(): number {
    return this.#shadow.r.baseVal.value;
  }
  set radius(newValue) {
    this.#shadow.r.baseVal.value = newValue;
    this.#highlight.r.baseVal.value = newValue;
  }
  setPosition(x: number, y: number) {
    this.#transform.setTranslate(x, y);
  }
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
  static async follow() {
    let mouseX = NaN;
    let mouseY = NaN;
    const start = makePromise();
    document.body.addEventListener("mousemove", (ev) => {
      mouseX = ev.pageX;
      mouseY = ev.pageY;
      start.resolve();
    });
    await start.promise;
    let previousX = mouseX;
    let previousY = mouseY;
    while (true) {
      let x = mouseX;
      let y = mouseY;
      const proposedDistance = Math.hypot(x - previousX, y - previousY);
      const maxStep = this.OFFSET * 2;
      if (proposedDistance > maxStep) {
        const θ = Math.atan2(x - previousX,y - previousY);
        const newOffset = polarToRectangular(maxStep, θ);
        x = previousX + newOffset.x;
        y = previousY + newOffset.y;
      }
      previousX = x;
      previousY = y;
      await this.start(x, y);
    }
  }
}

Wave.follow();
