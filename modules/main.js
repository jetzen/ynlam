
// set up service worker
/*
if ('serviceWorker' in navigator) { 
    window.addEventListener('load', function() {   
      navigator.serviceWorker.register('./sw.js').then(
  
        function(registration) { 
          // Registration was successful
          console.log('ServiceWorker registration successful with scope: ', registration.scope); }, 
        function(err) { 
          // registration failed :( 
          console.log('ServiceWorker registration failed: ', err); 
        }); 
  
    });
  }
*/


document.addEventListener("DOMContentLoaded", function(event) { 

    function loadFromHash() {
        let hash = window.location.hash;
        if (hash.startsWith('#')) {
            hash = hash.slice(1, hash.length + 1);
        }
        let xy = hash.split(',');
        if (xy && xy.length > 1) {
            let x = parseInt(xy[0]);
            let y = parseInt(xy[1]);
            if (x !== NaN && y !== NaN && x !== location.x && y !== location.y) {
                location.x = x;
                location.y = y;
                update();
            }
        }
    }

    function intersect(b1, b2) {
        let xint =
        b1.x0 >= b2.x0 && b1.x0 <= b2.x1 ||
        b1.x1 >= b2.x0 && b1.x1 <= b2.x1 ||
        b2.x0 >= b1.x0 && b2.x0 <= b1.x1 ||
        b2.x1 >= b1.x0 && b2.x1 <= b1.x1;

        let yint =
        b1.y0 >= b2.y0 && b1.y0 <= b2.y1 ||
        b1.y1 >= b2.y0 && b1.y1 <= b2.y1 ||
        b2.y0 >= b1.y0 && b2.y0 <= b1.y1 ||
        b2.y1 >= b1.y0 && b2.y1 <= b1.y1;    
        
        return xint && yint;
    }

    function wrapText(context, text, x, y, maxWidth, lineHeight) {
        let lines = text.split('\n');
        for(let ln = 0; ln < lines.length; ln++) {
            let words = lines[ln].split(' ');
            let line = '';

            for(let n = 0; n < words.length; n++) {
                let testLine = line + words[n] + ' ';
                let metrics = context.measureText(testLine);
                let testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    context.fillText(line, x, y);
                    line = words[n] + ' ';
                    y += lineHeight;
                }
                else {
                    line = testLine;
                }
            }
            context.fillText(line, x, y);

            // write out blank lines for linebreaks
            if(ln < lines.length) {
                y += lineHeight;
                context.fillText(' ', x, y);
            }
        }
    }

    let data = [
        {
            i: 999,
            cx: 0,
            cy: 0,
            x0: -100,
            y0: -100,
            x1: 100,
            y1: 100,
            t: 'you never even look at me :(',
        }
    ];

    let highlighted = false;
    let isMouse = false;

    const cv = document.getElementById('cv');
    const info = document.getElementById('info');
    const txtctr = document.getElementById('txtctr');
    const txt = document.getElementById('txt');
    const lnkDoPost = document.getElementById('lnkDoPost');
    const lnkNoPost = document.getElementById('lnkNoPost');

    const bgTileSize = 400; //320; // size of square background image
    const postWidth = 300;
    const fontSize = 24;
    const maxLength = 300; // words


    /*
        angle : 14.193995766201166
        center : {x: 798, y: 1279}
        changedPointers : [PointerEvent]
        deltaTime : 103
        deltaX : 427
        deltaY : 108
        direction : 4
        distance : 440.4463644985618
        eventType : 4
        isFinal : true
        isFirst : false
        maxPointers : 1
        offsetDirection : 4
        overallVelocity : 4.145631067961165
        overallVelocityX : 4.145631067961165
        overallVelocityY : 1.0485436893203883
        pointerType : "touch"

        type : "swipe"
        velocity : 9.06060606060606
        velocityX : 9.06060606060606
        velocityY : 3.212121212121212
    */    
    cvHammer = new Hammer(document.getElementById('ctr'), {        
        pointers: 1,
        threshold: 10,
        velocity: 0.3    
    });

    cvHammer.get('swipe').set({ direction: Hammer.DIRECTION_ALL });

    cvHammer.on('swipe', (evt) => {
        md = false;

        let start;
        let time = evt.deltaTime * 8;
        let move = { 
            deltaX: -1 * evt.deltaX * Math.abs(evt.overallVelocityX),
            deltaY: -1 * evt.deltaY * Math.abs(evt.overallVelocityY)
        };

        // try to make sure it doesn't look like we're going the wrong direction
        let modX = Math.abs(move.deltaX) % bgTileSize;
        let modY = Math.abs(move.deltaY) % bgTileSize;

        //console.log( modX + ', ' + modY );
        if(modX > bgTileSize / 2) {
            //console.log( 'backwards horiz?');
            move.deltaX += bgTileSize / 2 * Math.sign(move.deltaX);
        }

        if(modY > bgTileSize / 2) {
            //console.log('backwards vert?');
            move.deltaY += bgTileSize / 2 * Math.sign(move.deltaY);
        }

        let step  = function(timestamp) {
            start = start || timestamp;
            let elapsed = timestamp - start;

            let remaining = time - elapsed;
            let pct = remaining / time; 
            pct = pct > 0.3 ? 1 : pct;

            if(remaining > 0) {
                update({ 
                    deltaX : move.deltaX * pct, 
                    deltaY : move.deltaY * pct 
                });
                
                requestAnimationFrame(step);
            }
        }
        
        requestAnimationFrame(step);
    });

    const location = {
        x: 0,
        y: 0,
        z: 1
    };

    let editing = false;

    // new post position
    let ppos = {
        x: 0,
        y: 0
    };

    window.onkeydown = function(e) {
        if(editing && e.keyCode === 27) {
            txtctr.style.display = 'none';
            txt.value = '';
            editing = false;                
        }
    }

    window.onkeypress = function(e) {
        if(editing) {
            // auto-grow textarea height as needed.
            window.setTimeout(() => {
                let tooShort = txt.scrollHeight > txt.offsetHeight;                
        
                txt.style.height = txt.style.height || (txt.scrollHeight + 'px');                
        
                while(tooShort) {
                    txt.style.height = parseInt(txt.style.height) + 10 + 'px';
                    tooShort = txt.scrollHeight > txt.offsetHeight;
                }
                        
            }, 200);
            return;
        }
        editing = true;
        ppos.x = cpos.x;
        ppos.y = cpos.y;

        txtctr.style.top = (ppos.y - 45) + 'px';
        txtctr.style.left = (ppos.x - postWidth / 2 + 5) + 'px';
        // txtctr.style.width = postWidth + 'px';
        txtctr.style.display = 'block';
        txt.focus();   
    }

    lnkDoPost.onmousedown = function doPost(e) {

        let cx = location.x + ppos.x - client.cx + 8;
        let cy = location.y + ppos.y - client.cy + 10;

        // get minimum box size.. shrink it down until scrollbars are needed
        // vertical;
        let tooShort = txt.scrollHeight > txt.offsetHeight;
        let tooThin = txt.scrollWidth > txt.offsetWidth;

        txt.style.height = txt.style.height || (txt.scrollHeight + 'px');
        txt.style.width = txt.style.width || (txt.scrollWidth + 'px');

        while(!tooShort && parseInt(txt.style.height) > 50) {
            txt.style.height = parseInt(txt.style.height) - 10 + 'px';
            tooShort = txt.scrollHeight > txt.offsetHeight;
        }

        if(tooShort) {
            txt.style.height = parseInt(txt.style.height) + 10 + 'px';
        }

        while(!tooThin && parseInt(txt.style.width) > 50) {
            txt.style.width = parseInt(txt.style.width) - 10 + 'px';
            tooThin = txt.scrollWidth > txt.offsetWidth || txt.scrollHeight > txt.offsetHeight;
        }

        if(tooThin) {
            txt.style.width = parseInt(txt.style.width) + 10 + 'px';
        }
        
        let height = parseInt(txt.style.height) + 20;
        let width = parseInt(txt.style.width) + 20;
        
        data.push({
            cx: cx,
            cy: cy,
            x0: cx - width / 2 - 10,
            y0: cy - fontSize - 20,
            x1: cx + width / 2 + 10,
            y1: cy - fontSize - 20 + height + 20,
            t: txt.value.toString()
        });
        txtctr.style.display = 'none';
        txt.value = '';
        txt.style.height = 'auto';
        txt.style.width = 'auto';
        update();

        window.setTimeout(() => editing = false, 1000);
    }

    lnkNoPost.onmousedown = function noPost() {
        txtctr.style.display = 'none';
        txt.value = '';
    }

    // current position
    let cpos = {
        x: 0,
        y: 0
    };

    // mouse down position
    let mdp = {
        x: 0,
        y: 0
    };

    const cvs = document.getElementById('cv');
    const ctx = cvs.getContext('2d');

    let client = {
        w: document.documentElement.clientWidth,
        h: document.documentElement.clientHeight,
        cx: document.documentElement.clientWidth / 2,
        cy: document.documentElement.clientHeight / 2
    }
    
    cvs.setAttribute('height', client.h);
    cvs.setAttribute('width', client.w);

    let rst = undefined; // resize timout timer
    window.onresize = function() {
        if (rst) {
            window.clearTimeout(rst);
        }

        rst = window.setTimeout(() => {
            let clientW = document.documentElement.clientWidth;
            let clientH = document.documentElement.clientHeight;

            client = {
                w: clientW,
                h: clientH,
                cx: clientW / 2,
                cy: clientH / 2
            }
            
            cvs.setAttribute('height', client.h);
            cvs.setAttribute('width', client.w);   
            
            rst = undefined;

            update();

        }, 200);
    }

    window.onmouseover = function() {
        isMouse = true;
        window.onmouseover = undefined;
    }

    window.onhashchange = loadFromHash;

    let tmr = undefined;
    let tmd = undefined;
    let tms = undefined;
    let md = false;

    function mousedown(e) {

        let targetId = (e.target || {}).id;

        if (editing && targetId === txt.id) {
            return;
        }

        if (editing && targetId !== txt.id) {
            txtctr.style.display = 'none';
            editing = false;
        }

        if (!tmd) {

            e = e.type === 'touchstart' ? e.changedTouches[0] : e;

            tmd = window.setTimeout(function() {
                md = true;
                mdp = {
                    x: e.clientX,
                    y: e.clientY
                };
                tmd = undefined;
                //document.onmouseup = mouseup;
            }, 200);
        }
    }

    // cancel scrolling, cancel waiting for mousedown (not click) detection    
    function mouseup() {        
        let doUpdate = true;
        md = false;
        if (tmd) {
            window.clearTimeout(tmd);
            tmd = undefined;
            // no update from a simple click, no-drag
            doUpdate = false;
        }
        if (tmr) {
            window.clearInterval(tmr);
            tmr = undefined;
        }
        
        doUpdate && update();
        cpos.x = mdp.x;
        cpos.y = mdp.y;
        
    }
    
    function mousemove(e) {

        e = e.type === 'touchstart' ? e.changedTouches[0] : e;

        let px = parseInt(location.x + e.clientX - client.cx);
        let py = parseInt(location.y + e.clientY - client.cy);
       
        setInfo(location, {x:px, y:py});

        cpos.x =  e.clientX;
        cpos.y =  e.clientY;

        // if mouse is down, then drag screen position
        if(md) {
            
            if (tmr) {
                window.clearInterval(tmr);
                tmr = undefined;
            }
            
            update();

            tmr = window.setInterval(update, 60);

        } else {
            track(px, py);
        }

    }

    function mousewheel(e) {                

        if (editing || tms) {
            return;
        }

        tms = window.setTimeout(() => tms = undefined, 30);

        update({ deltaX: e.deltaX * 15, deltaY: e.deltaY * 15});
        
        // tms = window.setInterval(function() { update({ deltaX: e.deltaX, deltaY: e.deltaY}); }, 60);        
    }

    function setInfo(pgXY, msXY) {
        let tgtCoord = isMouse ? '<BR>' + msXY.x + ',' + msXY.y : '';
        info.innerHTML = `${pgXY.x},${pgXY.y}${tgtCoord}`;
    }

    window.onmousewheel = mousewheel;
    
/*
    document.onmousedown = mousedown;
    document.onmouseup = mouseup;
    document.onmousemove = mousemove;


    window.ontouchstart = mousedown;
    window.ontouchend = mouseup;
*/
    window.onpointerdown = mousedown;
    window.onpointerup = mouseup;
    window.onpointermove = mousemove;

    function update(scroll) {

        let diffX = cpos.x - mdp.x;
        let diffY = cpos.y - mdp.y;

        if (scroll) {
            diffX = scroll.deltaX;
            diffY = scroll.deltaY;
        }

        if (editing) {
            diffX = 0;
            diffY = 0;
        }

        let r = Math.sqrt(diffX * diffX + diffY * diffY);
        let mx = parseInt(-1 * diffX / 10);
        let my = parseInt(-1 * diffY / 10);

        location.x = parseInt((location.x || 0) - mx);
        location.y = parseInt((location.y || 0) - my);

        let xy = `${location.x},${location.y}`;
        let px = parseInt(location.x + cpos.x - client.cx);
        let py = parseInt(location.y + cpos.y - client.cy);
        setInfo(location, {x:px, y:py});
        
        window.location.hash = xy;

        // move background image and update canvas location        
        let bgX = parseInt(cv.style.backgroundPositionX || 0) + mx;
        let bgY = parseInt(cv.style.backgroundPositionY || 0) + my;

        cv.style.backgroundPositionX = bgX + 'px';
        cv.style.backgroundPositionY = bgY + 'px';
        ctx.clearRect(0, 0, client.w, client.h);
        ctx.transform(1, 0, 0, 1, location.x + 'px', location.y + 'px');

        // draw line & circle showing direction / magnitude of travel
        if (md) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(256,128,128,0.25)';
            ctx.lineWidth = 3;
            ctx.moveTo(mdp.x, mdp.y);
            ctx.lineTo(cpos.x, cpos.y);
            ctx.stroke();
            ctx.closePath();

            ctx.arc(cpos.x, cpos.y, 8 + r / 25, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(256,128,128,0.5)';
            ctx.fill();
        }

        // draw any text that should be onscreen
        
        // get current boundaries
        let bounds = {
            x0: location.x - client.w / 2,
            y0: location.y - client.h / 2,
            x1: location.x + client.w / 2,
            y1: location.y + client.h / 2
        }

        ctx.font = fontSize + 'px arial';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';

        data.forEach(d => {
            d.onscreen = intersect(bounds, d);
            if (d.onscreen) {
                wrapText(ctx, d.t, d.cx - location.x + client.cx, d.cy - location.y + client.cy, d.x1 - d.x0, fontSize + 6);
                
                // for testing / verification, draw bounding box
                // ctx.strokeRect(d.x0 - location.x + client.cx, d.y0 - location.y + client.cy, d.x1 - d.x0, d.y1 - d.y0);

                if (intersect(d, {x0: px, x1: px, y0: py, y1: py})) {
                    highlight(d);
                }                 
            } 
        });

    }

    function track(px, py) {
        let isOver = false;
        data.forEach(d => {
            if (d.onscreen) {
                if (intersect(d, {x0: px, x1: px, y0: py, y1: py})) {
                    highlight(d);
                    isOver = true;                    
                }                
            } 
        });

        if (highlighted && !isOver) {
            update({ deltaX: 0, deltaY: 0});
        }

        highlighted = isOver;
    };

    function highlight(d) {        
        //console.dir(d);
        ctx.strokeStyle = 'rgba(256,128,128,0.8)';
        ctx.lineWidth = 3;
        ctx.strokeRect(d.x0 - location.x + client.cx, d.y0 - location.y + client.cy, d.x1 - d.x0, d.y1 - d.y0);
        
        //ctx.strokeRect(location.x + d.x0, location.y + d.y0, d.x1 - d.x0, d.y1 - d.y0);

    }    

    loadFromHash();

});