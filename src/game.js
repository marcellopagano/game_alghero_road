import { audio } from "./audio.js";

import hole1 from "/public/img/hole1.png";
import hole2 from "/public/img/hole2.png";
import Car from "/public/img/car-lee.png";
import Car1 from "/public/img/enemy-car1.png";
import Car2 from "/public/img/enemy-car2.png";
import Car3 from "/public/img/enemy-car3.png";
import Car4 from "/public/img/enemy-car4.png";
import Car5 from "/public/img/enemy-car5.png";
import Car6 from "/public/img/enemy-car6.png";
import Car7 from "/public/img/enemy-car7.png";

/* Game Object: Simple game where a car avoids cars and potholes.
	 API:
	 - Game.init(canvas)      -> init game on html element <canvas> 
	 - Game.start()            -> start loop game
	 - Game.stop()             -> stop loop game
	 - Game.reset()            -> reset game/score
	 - Game.handleKey(e)       -> input keyboard (opt)

	 exposes: window.Game
*/
const Game = (function () {
  const config = {
    // car
    carWidth: 60,
    carHeight: 90,
    carImageSrc: Car,
    lanePadding: 20,
    // hole
    potholeWidth: 60,
    potholeHeight: 30,
    spawnInterval: 900,
    potholeSpeedBase: 180,
    maxPotholes: 3,
    potholeMinSize: 20,
    potholeMaxSize: 30,
    potholeImageSrcs: [hole1, hole2],
    // top bar height (px)
    titleHeight: 44,
    // road/stripe config
    roadSpeed: 220,
    laneStripe: { dash: 50, gap: 30, width: 10 },
    // enemy car
    enemyCarWidth: 60,
    enemyCarHeight: 90,
    enemyCarImageSrcs: [Car1, Car2, Car3, Car4, Car5, Car6, Car7],
    enemySpawnInterval: 1200,
    enemySpeedBase: 160,
    maxEnemyCars: 3,
    enemyCarHorizontalVariation: 100, // ±px
    enemyCarSpawnOffsetY: -50, // offset Y top bar
    // bonus health
    bonusWidth: 40,
    bonusHeight: 40,
    bonusSpeed: 140,
    healAmount: 20, // percent
  };

  let canvas = null;
  let ctx = null;
  let w = 0;
  let h = 0;

  let isColliding = false;
  let running = false;
  let lastTime = 0;
  let spawnTimer = 0;
  let score = 0;
  let health = 100; // percent
  // images
  let carImg = null;
  const potholeImgs = []; // array image holes
  const enemyCarImgs = []; // array image enemy car

  const car = {
    x: 0,
    y: 0,
    vx: 0,
    speed: 350,
    steeringSpeed: 150,
    width: config.carWidth,
    height: config.carHeight,
  };

  const potholes = [];
  const enemyCars = [];
  const bonuses = [];
  let roadOffset = 0;
  let enemySpawnTimer = 0;
  let nextBonusHealth = 70; // spawn bonus when health falls to this or below

  // get record from local store
  function getRecord() {
    const record = localStorage.getItem("record") || 0;
    return record;
  }
  // put record on local store
  function putRecord(score) {
    const prevRecord = localStorage.getItem("record", score);
    if (score > prevRecord) {
      localStorage.setItem("record", score);
    }
  }

  function resize() {
    if (!canvas) return;
    // limit max width 800px for mobile device
    const dpr = window.devicePixelRatio || 1;
    const displayW = Math.min(canvas.clientWidth, 800);
    const displayH = canvas.clientHeight;

    canvas.style.width = displayW + "px";
    canvas.style.height = displayH + "px";
    canvas.width = Math.max(1, Math.round(displayW * dpr));
    canvas.height = Math.max(1, Math.round(displayH * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    w = displayW;
    h = displayH;
    car.x = (w - car.width) / 2;
    car.y = h - car.height - 50;
  }

  function spawnPothole() {
    if (potholes.length >= config.maxPotholes) return;
    // random shape hole
    const pw =
      config.potholeMinSize +
      Math.random() * (config.potholeMaxSize - config.potholeMinSize);
    const ph =
      Math.random() < 0.5
        ? pw
        : config.potholeMinSize +
          Math.random() * (config.potholeMaxSize - config.potholeMinSize);
    const x =
      Math.random() * (w - pw - config.lanePadding * 2) + config.lanePadding;
    const speed = config.potholeSpeedBase; // speed hole fix
    // hole spawn position
    const startY = config.titleHeight - ph - 2;
    potholes.push({
      x,
      y: startY,
      w: pw,
      h: ph,
      speed,
      img: potholeImgs.length
        ? potholeImgs[Math.floor(Math.random() * potholeImgs.length)]
        : null,
    });
  }

  function spawnBonus() {
    // spawn bonus health position
    const leftLimit = config.lanePadding + 20;
    const rightLimit = w - config.lanePadding - 20 - config.bonusWidth;
    const x = Math.random() * (rightLimit - leftLimit) + leftLimit;
    const startY = config.titleHeight - config.bonusHeight - 2;
    bonuses.push({
      x,
      y: startY,
      w: config.bonusWidth,
      h: config.bonusHeight,
      speed: config.bonusSpeed,
    });
  }

  function spawnEnemyCar() {
    // spawn enemy car position
    if (enemyCars.length >= config.maxEnemyCars) return;
    const borderW = 6;
    const inset = 12;
    const centerX = w / 2;
    const stripeW = config.laneStripe.width;
    const startY =
      config.titleHeight - config.enemyCarHeight + config.enemyCarSpawnOffsetY;
    const minDistance = config.enemyCarHeight + 50;

    // spawn enemy card random lane
    const lanes = [0, 1];
    if (Math.random() < 0.5) lanes.reverse();

    for (const lane of lanes) {
      let x;
      if (lane === 0) {
        const laneStart = inset + borderW;
        const laneEnd = centerX - stripeW / 2 - config.enemyCarWidth;
        // center lane + variation
        const base = laneStart + (laneEnd - laneStart) / 2;
        x =
          base +
          (Math.random() * config.enemyCarHorizontalVariation * 2 -
            config.enemyCarHorizontalVariation);
        // clamp inside the lane
        x = Math.max(laneStart, Math.min(x, laneEnd));
      } else {
        const laneStart = centerX + stripeW / 2;
        const laneEnd = w - inset - borderW - config.enemyCarWidth;
        const base = laneStart + (laneEnd - laneStart) / 2;
        x =
          base +
          (Math.random() * config.enemyCarHorizontalVariation * 2 -
            config.enemyCarHorizontalVariation);
        x = Math.max(laneStart, Math.min(x, laneEnd));
      }
      // check distance enemy car
      let ok = true;
      for (const e of enemyCars) {
        if (e.lane === lane && Math.abs(e.y - startY) < minDistance) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      // spawn
      enemyCars.push({
        x,
        y: startY,
        w: config.enemyCarWidth,
        h: config.enemyCarHeight,
        speed: config.enemySpeedBase,
        lane,
        img: enemyCarImgs.length
          ? enemyCarImgs[Math.floor(Math.random() * enemyCarImgs.length)]
          : null,
      });
      return;
    }
  }

  function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(x1 + w1 < x2 || x1 > x2 + w2 || y1 + h1 < y2 || y1 > y2 + h2);
  }

  function update(dt) {
    // check collision blink
    if (isColliding) {
      // Reset after .3 seconds
      setTimeout(() => {
        isColliding = false;
      }, 300);
    }
    // update road offset - scroll effect
    roadOffset -= config.roadSpeed * dt;
    const pattern = config.laneStripe.dash + config.laneStripe.gap;
    if (roadOffset > pattern) roadOffset = roadOffset % pattern;
    // update car
    car.x += car.vx * dt;
    if (car.x < 0) car.x = 0;
    if (car.x + car.width > w) car.x = w - car.width;
    spawnTimer += dt * 1000;
    // update holes
    spawnTimer += dt * 1000;
    if (spawnTimer > Math.max(220, config.spawnInterval - score * 6)) {
      spawnTimer = 0;
      spawnPothole();
    }
    // update enemy cars
    enemySpawnTimer += dt * 1000;
    if (
      enemySpawnTimer > Math.max(300, config.enemySpawnInterval - score * 5)
    ) {
      enemySpawnTimer = 0;
      spawnEnemyCar();
    }
    // clear potholes
    for (let i = potholes.length - 1; i >= 0; i--) {
      const p = potholes[i];
      p.y += p.speed * dt;
      if (p.y > h) {
        potholes.splice(i, 1);
        score += 10;
      }
    }
    // clear enemy cars
    for (let i = enemyCars.length - 1; i >= 0; i--) {
      const e = enemyCars[i];
      e.y += e.speed * dt;
      if (e.y > h) {
        enemyCars.splice(i, 1);
        score += 20;
      }
    }
    // clear bonus health
    for (let i = bonuses.length - 1; i >= 0; i--) {
      const b = bonuses[i];
      b.y += b.speed * dt;
      if (b.y > h) {
        bonuses.splice(i, 1);
      }
    }
    // spawn bonus health
    if (health <= nextBonusHealth && nextBonusHealth > 0) {
      spawnBonus();
      nextBonusHealth -= 40;
    }
    // bonus health collision
    for (let i = bonuses.length - 1; i >= 0; i--) {
      const b = bonuses[i];
      if (
        rectsOverlap(car.x, car.y, car.width, car.height, b.x, b.y, b.w, b.h)
      ) {
        health += config.healAmount;
        audio.bonus.play();
        if (health > 100) health = 100;
        bonuses.splice(i, 1);
      }
    }

    // holes collision
    for (let i = potholes.length - 1; i >= 0; i--) {
      const p = potholes[i];
      if (
        rectsOverlap(car.x, car.y, car.width, car.height, p.x, p.y, p.w, p.h)
      ) {
        isColliding = true;
        health -= 10;
        audio.hole.play();
        if (health < 0) health = 0;
        potholes.splice(i, 1);
        if (health <= 0) {
          stop();
        }
      }
    }

    // enemy car collision
    for (let i = enemyCars.length - 1; i >= 0; i--) {
      const e = enemyCars[i];
      if (
        rectsOverlap(
          car.x,
          car.y,
          car.width,
          car.height,
          e.x + 20,
          e.y + 40,
          e.w,
          e.h,
        )
      ) {
        audio.horn.play();
      }
      if (
        rectsOverlap(car.x, car.y, car.width, car.height, e.x, e.y, e.w, e.h)
      ) {
        isColliding = true;
        health -= 20;
        audio.crash.play();
        if (health < 0) health = 0;
        enemyCars.splice(i, 1);
        if (health <= 0) {
          stop();
        }
      }
    }
  }

  function draw() {
    if (!ctx) return;
    // background
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(0, 0, w, h);

    const titleHeight = 44;
    // road
    const roadTop = titleHeight;
    const roadHeight = h - roadTop;
    ctx.fillStyle = "#444";
    ctx.fillRect(0, roadTop, w, roadHeight);

    // road - side lines
    ctx.fillStyle = "#fff";
    const borderW = 6;
    const inset = 12;
    ctx.fillRect(inset, roadTop, borderW, roadHeight);
    ctx.fillRect(w - inset - borderW, roadTop, borderW, roadHeight);

    // road - center line
    const dash = config.laneStripe.dash;
    const gap = config.laneStripe.gap;
    const stripeW = config.laneStripe.width;
    const patternLen = dash + gap;
    const offset = roadOffset % patternLen;
    const centerX = Math.round(w / 2 - stripeW / 2);
    ctx.fillStyle = "#fff";
    // draw after offset
    let sy = roadTop - offset - 15; // fix center road line
    while (sy < h) {
      if (sy + dash > roadTop) {
        ctx.fillRect(centerX, Math.max(sy, roadTop), stripeW, dash);
      }
      sy += patternLen;
    }

    // If colliding, toggle visibility based on current time
    let blinkSpeed = 50; // Speed of blink in ms
    if (!isColliding || Math.floor(Date.now() / blinkSpeed) % 2) {
      ctx.drawImage(carImg, car.x, car.y, car.width, car.height);
    }

    // car (player)
    // if (carImg && carImg.complete && carImg.naturalWidth > 0) {
    //   ctx.drawImage(carImg, car.x, car.y, car.width, car.height);
    // } else {
    //   ctx.fillStyle = "rgba(255,0,0, 0";
    //   ctx.fillRect(car.x, car.y, car.width, car.height);
    // }

    // holes
    for (const p of potholes) {
      if (p.img && p.img.complete && p.img.naturalWidth > 0) {
        ctx.drawImage(p.img, p.x, p.y, p.w, p.h);
      } else {
        ctx.fillStyle = "#222";
        ctx.beginPath();
        ctx.ellipse(
          p.x + p.w / 2,
          p.y + p.h / 2,
          p.w / 2,
          p.h / 2,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    // bonus health
    ctx.fillStyle = "#0f0";
    for (const b of bonuses) {
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = "#080";
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h); // testo healing
      ctx.fillStyle = "#000";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("+" + config.healAmount, b.x + b.w / 2, b.y + b.h / 2 + 4);
      ctx.textAlign = "start";
    }
    // enemy cars
    for (const e of enemyCars) {
      if (e.img && e.img.complete && e.img.naturalWidth > 0) {
        ctx.drawImage(e.img, e.x, e.y, e.w, e.h);
      } else {
        ctx.fillStyle = "#1f1f1f";
        ctx.fillRect(e.x, e.y, e.w, e.h);
      }
    }

    // black bar top
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(0, 0, w, titleHeight);
    // black bar bottom
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(0, canvas.clientHeight - 44, w, titleHeight);
    // HUD
    ctx.fillStyle = "#fff";
    ctx.font = "16px sans-serif";
    // life bar
    const healthBarW = 100;
    const healthBarH = 12;
    const healthX = 10;
    const healthY = 30;
    ctx.fillStyle = "#555";
    ctx.fillRect(healthX, healthY, healthBarW, healthBarH);
    ctx.fillStyle = "#0f0";
    ctx.fillRect(healthX, healthY, (health / 100) * healthBarW, healthBarH);
    ctx.strokeStyle = "#000";
    ctx.strokeRect(healthX, healthY, healthBarW, healthBarH);
    // score bar
    ctx.fillStyle = "#fff";
    ctx.fillText("Score: " + score, 10, 22);

    // record screen
    if (!running) {
      putRecord(score);
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.fillRect(w / 2 - 120, h / 2 - 40, 240, 80);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "18px sans-serif";
      ctx.fillText("Il tuo Record:", w / 2, h / 2 - 6);
      ctx.fillText(`${getRecord()} punti.`, w / 2, h / 2 + 18);
      ctx.textAlign = "start";
    }
  }
  // loop game
  function loop(ts) {
    if (!running) return;
    if (!lastTime) lastTime = ts;
    const dt = Math.min(0.05, (ts - lastTime) / 1000);
    lastTime = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  // start game
  function start() {
    if (!canvas) return;
    if (running) return;
    audio.engine.loop = true;
    audio.engine.play();
    running = true;
    lastTime = 0;
    requestAnimationFrame(loop);
  }
  // stop game
  function stop() {
    running = false;
    // end game sound effect
    if (score > getRecord()) {
      audio.hornLee.play();
    } else {
      audio.gameover.play();
    }
    audio.engine.loop = false;
    audio.engine.pause();
    audio.engine.currentTime = 0;
  }
  // reset game
  function reset() {
    score = 0;
    health = 100;
    potholes.length = 0;
    enemyCars.length = 0;
    bonuses.length = 0;
    spawnTimer = 0;
    enemySpawnTimer = 0;
    nextBonusHealth = 50;
    car.x = (w - car.width) / 2;
    car.vx = 0;
  }
  // keyboard handle
  function handleKey(e) {
    const key = e.type === "keydown" ? e.key : null;
    if (!key) return;
    if (key === "ArrowLeft") {
      car.vx = -car.steeringSpeed;
      !running || audio.break.play();
    } else if (key === "ArrowRight") {
      car.vx = car.steeringSpeed;
      !running || audio.break.play();
    } else if (key === "Enter") {
      if (!running) {
        reset();
        start();
      }
    }
  }
  // keyboard release
  function handleKeyUp(e) {
    const key = e.key;
    if (key === "ArrowLeft" || key === "ArrowRight") {
      car.vx = 0;
    }
  }

  function init(c) {
    const btnStart = window.document.getElementById("btnStart");
    const btnLeft = window.document.getElementById("btnLeft");
    const btnRight = window.document.getElementById("btnRight");
    canvas = c;
    ctx = canvas.getContext("2d");
    resize();
    // keyboard arrow direction car (player)
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKeyUp);
    // phone touch support
    if (navigator.vibrate) {
      // start btn
      btnStart.addEventListener("touchstart", () => {
        if (!running) {
          Game.reset();
          Game.start();
        }
      });
      // left direction car button
      btnLeft.addEventListener("touchstart", () => {
        car.vx = -car.steeringSpeed;
        !running || audio.break.play();
      });
      btnLeft.addEventListener("touchend", () => {
        car.vx = 0;
      });
      // right direction car button
      btnRight.addEventListener("touchstart", () => {
        car.vx = +car.steeringSpeed;
        !running || audio.break.play();
      });
      btnRight.addEventListener("touchend", () => {
        car.vx = 0;
      });
    }

    // load images
    if (config.carImageSrc) {
      carImg = new Image();
      carImg.src = config.carImageSrc;
    }
    if (Array.isArray(config.potholeImageSrcs)) {
      for (const src of config.potholeImageSrcs) {
        const img = new Image();
        img.src = src;
        potholeImgs.push(img);
      }
    }
    if (Array.isArray(config.enemyCarImageSrcs)) {
      for (const src of config.enemyCarImageSrcs) {
        const img = new Image();
        img.src = src;
        enemyCarImgs.push(img);
      }
    }

    // initial draw
    draw();
  }

  return {
    init,
    start,
    stop,
    reset,
    handleKey,
    // for debugging/inspection
    _state: () => ({
      running,
      score,
      potholes: potholes.length,
      car: { x: car.x, y: car.y },
    }),
  };
})();

window.Game = Game;
