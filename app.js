import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabaseUrl = 'https://supabase.lama-id.de'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzA0NDA5MjAwLAogICJleHAiOiAxODYyMjYyMDAwCn0.r_Iv-w4S5DncSzdO5CSIr0nIdOxG6kQFhzMkxvp6a4A'
let supabase;

const idPdfBytes = await fetch('id_schueler.pdf').then((res) => res.arrayBuffer());
const bahnschriftBytes = await fetch('bahnschrift-SemiLight.ttf').then((res) => res.arrayBuffer());
const standardWidth = 86.6; const standardHeight = 55;
let width, height, bahnschrift;

const appEle = document.getElementById("app");
const statusText = document.getElementById("status-text");

function blobToImage(blob) {
    return new Promise(resolve => {
        const url = URL.createObjectURL(blob)
        let img = new Image()
        img.onload = () => {
            if (img.width === 0) {
                console.error('Image has no width');
                throw new Error('Image has no width')
            }
            URL.revokeObjectURL(url)
            resolve(img)
        }
        img.src = url
    })
}

async function picFinished(pic, frame, size, i, pictureList) {
    console.log("Cropping of the picture finished");
    const { data, error } = await supabase
        .from('picture_list')
        .update({ frame: frame, size: size, crop_disabled: false, original_state: pictureList[i] })
        .eq('picture_id', pictureList[i].picture_id)
        .select()
    pictureList[i].frame = frame;
    pictureList[i].size = size;
    showSite(i, pictureList)
}

function closeCanvas() {
    console.log('Closing canvas')
    document.getElementById("crop-canvas").remove()
    document.getElementById("pic-border-container").remove()
    document.body.style.overflowY = 'scroll'
    document.body.style.position = 'relative'
    document.body.style.touchAction = 'auto'
}

function cropPhoto(pic, i, pictureList) {
    console.log(pic)
    document.body.style.overflowY = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.touchAction = 'none'

    let timeout;
    window.addEventListener("resize", () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            if (document.getElementById("crop-canvas")) {
                closeCanvas();
                cropPhoto(pic, i, pictureList);
            }
        }, 250);
    })

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    let vh = windowHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    console.log(windowHeight, windowWidth)

    appEle.innerHTML += '<canvas id="crop-canvas"></canvas><div class="center-content" id="pic-border-container"><div id="pic-border"></div><button id="pic-border-btn">OK</button></div>'
    const borderDims = document.getElementById("pic-border").getBoundingClientRect();
    document.getElementById("pic-border-btn").addEventListener('click', () => {
        let leftPic = ((((windowWidth / 2) - cameraOffset.x) * cameraZoom) - (((windowWidth / 2) - borderDims.left) - ((pic.width * cameraZoom) / 2))) / cameraZoom
        let topPic = ((((windowHeight / 2) - cameraOffset.y) * cameraZoom) - (((windowHeight / 2) - borderDims.top) - ((pic.height * cameraZoom) / 2))) / cameraZoom
        let rightPic = borderDims.width / cameraZoom
        let bottomPic = borderDims.height / cameraZoom
        closeCanvas()
        console.log([leftPic, topPic, rightPic, bottomPic], [pic.width, pic.height], cameraZoom, borderDims, cameraOffset, pic)
        picFinished(pic, [leftPic, topPic, rightPic, bottomPic], [pic.width, pic.height], i, pictureList)
    })

    let canvas = document.getElementById("crop-canvas")
    let ctx = canvas.getContext('2d')

    let cameraOffset = { x: windowWidth / 2, y: windowHeight / 2 }
    let cameraZoom = 1
    let MAX_ZOOM = 5
    let MIN_ZOOM = 0
    let SCROLL_SENSITIVITY = 0.0005

    if ((pic.width / pic.height) < 24 / 30) {
        cameraZoom = document.getElementById("pic-border").getBoundingClientRect().width / pic.width;
    } else {
        cameraZoom = document.getElementById("pic-border").getBoundingClientRect().height / pic.height;
    }

    function draw(pic) {
        canvas.width = windowWidth
        canvas.height = windowHeight

        // Translate to the canvas centre before zooming - so you'll always zoom on what you're looking directly at
        ctx.translate(windowWidth / 2, windowHeight / 2)
        ctx.scale(cameraZoom, cameraZoom)
        ctx.translate(-windowWidth / 2/* + cameraOffset.x*/, -windowHeight / 2/* + cameraOffset.y*/)
        ctx.clearRect(0, 0, windowWidth, windowHeight)

        ctx.drawImage(pic, cameraOffset.x - ((pic.width) / 2), cameraOffset.y - ((pic.height) / 2));

        requestAnimationFrame(() => { draw(pic) })
    }

    // Gets the relevant location from a mouse or single touch event
    function getEventLocation(e) {
        if (e.touches && e.touches.length == 1) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY }
        }
        else if (e.clientX && e.clientY) {
            return { x: e.clientX, y: e.clientY }
        }
    }

    let isDragging = false
    let dragStart = { x: 0, y: 0 }

    function onPointerDown(e) {
        if (!getEventLocation(e)) return;
        isDragging = true
        dragStart.x = getEventLocation(e).x / cameraZoom - cameraOffset.x
        dragStart.y = getEventLocation(e).y / cameraZoom - cameraOffset.y
    }

    function onPointerUp(e) {
        isDragging = false
        initialPinchDistance = null
        lastPosX = [null, null]
        lastPosY = [null, null]
        lastZoom = cameraZoom
    }

    function onPointerMove(e) {
        if (!getEventLocation(e)) return;
        if (isDragging) {
            cameraOffset.x = getEventLocation(e).x / cameraZoom - dragStart.x
            cameraOffset.y = getEventLocation(e).y / cameraZoom - dragStart.y
        }
    }

    function handleTouch(e, singleTouchHandler) {
        if (e.touches.length == 1) {
            singleTouchHandler(e)
        }
        else if (e.type == "touchmove" && e.touches.length == 2) {
            isDragging = false
            handlePinch(e)
        }
    }

    let initialPinchDistance = null
    let lastPosX = [null, null]
    let lastPosY = [null, null]
    let lastZoom = cameraZoom

    function handlePinch(e) {
        e.preventDefault()

        let touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        let touch2 = { x: e.touches[1].clientX, y: e.touches[1].clientY }

        if ((lastPosX[0] !== null) && (lastPosX[0] > touch1.x && lastPosX[1] > touch2.x) || (lastPosX[0] < touch1.x && lastPosX[1] < touch2.x)) {
            let change = (((touch1.x - lastPosX[0]) + (touch2.x - lastPosX[1])) / 2) / cameraZoom
            change = Math.min(change, 20)
            change = Math.max(change, -20)
            cameraOffset.x += change
        }
        lastPosX[0] = touch1.x
        lastPosX[1] = touch2.x

        if ((lastPosY[0] !== null) && (lastPosY[0] > touch1.y && lastPosY[1] > touch2.y) || (lastPosY[0] < touch1.y && lastPosY[1] < touch2.y)) {
            let change = (((touch1.y - lastPosY[0]) + (touch2.y - lastPosY[1])) / 2) / cameraZoom
            change = Math.min(change, 20)
            change = Math.max(change, -20)
            cameraOffset.y += change
        }
        lastPosY[0] = touch1.y
        lastPosY[1] = touch2.y

        // This is distance squared, but no need for an expensive sqrt as it's only used in ratio
        let currentDistance = (touch1.x - touch2.x) ** 2 + (touch1.y - touch2.y) ** 2

        if (initialPinchDistance == null) {
            initialPinchDistance = currentDistance
        }
        else {
            let zoomChange = currentDistance / initialPinchDistance
            adjustZoom(null, zoomChange)
        }
    }

    function adjustZoom(zoomAmount, zoomFactor) {
        if (!isDragging) {
            if (zoomAmount) {
                cameraZoom *= zoomAmount
            }
            else if (zoomFactor) {
                cameraZoom = zoomFactor * lastZoom
            }

            //cameraZoom = Math.min(cameraZoom, MAX_ZOOM)
            cameraZoom = Math.max(cameraZoom, MIN_ZOOM)
        }
    }

    canvas.addEventListener('mousedown', onPointerDown)
    canvas.addEventListener('touchstart', (e) => handleTouch(e, onPointerDown))
    canvas.addEventListener('mouseup', onPointerUp)
    canvas.addEventListener('touchend', (e) => handleTouch(e, onPointerUp))
    canvas.addEventListener('mousemove', onPointerMove)
    canvas.addEventListener('touchmove', (e) => handleTouch(e, onPointerMove))
    canvas.addEventListener('wheel', (e) => adjustZoom((1 + (e.deltaY * SCROLL_SENSITIVITY))))

    draw(pic)
}

async function svgToPng(svg) {
    return new Promise((resolve) => {
        const url = getSvgUrl(svg);
        svgUrlToPng(url).then((imgData) => {
            resolve(imgData);
            URL.revokeObjectURL(url);
        });
    })
}
function getSvgUrl(svg) {
    return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
}
function svgUrlToPng(svgUrl) {
    return new Promise((resolve) => {
        const svgImage = document.createElement('img');
        document.body.appendChild(svgImage);
        svgImage.onload = function () {
            const canvas = document.createElement('canvas');
            canvas.style.display = 'none';
            canvas.width = svgImage.clientWidth;
            canvas.height = svgImage.clientHeight;
            const canvasCtx = canvas.getContext('2d');
            canvasCtx.drawImage(svgImage, 0, 0);
            const imgData = canvas.toDataURL('image/png');
            svgImage.remove();
            resolve(imgData);
        };
        svgImage.src = svgUrl;
    })
}

function drawText(page, text, x, y) {
    page.drawText(text, {
        x: x * (width / standardWidth),
        y: height - (y * (height / standardHeight)),
        size: 9.3,
        font: bahnschrift,
        color: PDFLib.rgb(0, 0, 0),
    })
}

function clipImage(image, frame) {
    return new Promise(async (resolve) => {
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = frame[2];
        canvas.height = frame[3];
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, frame[2], frame[3]);
        ctx.drawImage(image, frame[0], frame[1], frame[2], frame[3], 0, 0, frame[2], frame[3]);
        const clippedImage = await canvas.toDataURL("image/jpeg", 1)
        resolve(clippedImage)
    })
}

function createIDsForClass(users, className, preprint) {
    return new Promise(async (resolve) => {
        console.log(`Creating IDs for class ${className}`, users);
        statusText.innerHTML = `Klasse ${className} wird erstellt`

        const idPdf = await PDFLib.PDFDocument.create()
        const srcPdf = await PDFLib.PDFDocument.load(idPdfBytes);
        for (let i = 0; i < users.length; i++) {
            const copiedPages = await idPdf.copyPages(srcPdf, [0, 1])
            idPdf.addPage(copiedPages[0])
            idPdf.addPage(copiedPages[1])
        }
        idPdf.registerFontkit(fontkit)
        bahnschrift = await idPdf.embedFont(bahnschriftBytes)
        let pages = idPdf.getPages()
        width = pages[0].getSize().width
        height = pages[0].getSize().height

        let pictureIDs = []

        for (let i = 0; i < users.length; i++) {
            const userID = users[i];
            console.debug('Creating ID for user', userID)
            let { data: user, error: userError } = await supabase
                .from('users')
                .select("*")
                .eq('id', userID)
            if (userError) {
                console.error(userError)
                throw new Error(`Supabase error getting user data: ${userID}`);
            }
            if (user.length === 0) {
                console.warn('User not found')
                throw new Error(`User not found: ${userID}`);
            }
            user = user[0]

            const { data: userClass, error: classError } = await supabase
                .from('classes')
                .select('*')
                .eq("id", user.class_id)
            if (classError) {
                console.error(classError)
                throw new Error(`Supabase error getting class data: ${userID}`);
            }
            if (userClass.length === 0) {
                console.warn('Class not found')
                throw new Error(`Class not found: ${userID}`);
            }
            user.class_name = userClass[0].name

            let { data: picture, error: picError } = await supabase
                .from('verified_pictures')
                .select('*')
                .eq("user_id", userID)
                .eq("status", "ACCEPTED")
            if (picError) {
                console.error(picError)
                throw new Error(`Supabase error getting picture data: ${userID}`);
            }
            if (picture.length === 0) {
                console.log('No accepted picture not found')
                throw new Error(`No accepted picture not found: ${userID}`);
            }
            picture = picture[0]
            pictureIDs.push(picture.picture_id)

            let { data: pictureList, error: picListError } = await supabase
                .from('picture_list')
                .select('*')
                .eq("picture_id", picture.picture_id)
            if (picListError) {
                console.error(picListError)
                throw new Error(`Supabase error getting picture data: ${userID}`);
            }
            if (pictureList.length === 0) {
                console.log('No accepted picture not found')
                throw new Error(`No accepted picture not found: ${userID}`);
            }
            pictureList = pictureList[0]

            const { data: file, error: fileError } = await supabase.storage
                .from('pictures')
                .download(picture.user_id + '/' + picture.picture_id + '.jpg');
            if (fileError) {
                console.error(picError)
                throw new Error(`Supabase error downloading picture data: ${userID}`);
            }

            const clippedImage = await clipImage(await blobToImage(await file), pictureList.frame)
            const image = await idPdf.embedJpg(clippedImage)
            pages[i * 2].drawImage(image, {
                x: 4.035 * (width / standardWidth),
                y: height - (44.793 * (height / standardHeight)),
                width: 24 * (width / standardWidth),
                height: 30 * (height / standardHeight),
            })

            await addTextAndBarcode(pages, i, user, idPdf);
        }

        const pdfDataUri = await idPdf.saveAsBase64({ dataUri: true });
        //window.location = pdfDataUri;

        const link = document.createElement("a");
        link.href = pdfDataUri;
        link.download = className + '.pdf';
        link.click();

        for (let i = 0; i < pictureIDs.length; i++) {
            const { data, error } = await supabase
                .from('verified_pictures')
                .update({ status: 'PRINTED' })
                .eq('picture_id', pictureIDs[i])
                .select()
        }

        resolve();
    })
}

async function addTextAndBarcode(pages, i, user, idPdf) {
    drawText(pages[i * 2], new Date(user.valid_date).toLocaleDateString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).substring(0, 19), 45.733, 17.771);
    drawText(pages[i * 2], user.last_name.substring(0, 19), 40.822, 25.706);
    drawText(pages[i * 2], user.first_name.substring(0, 19), 45.189, 33.628);
    drawText(pages[i * 2], new Date(user.birthdate).toLocaleDateString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).substring(0, 19), 52.596, 41.824);

    const barcodePng = await createBarcode(user.stud_id);
    const barcode = await idPdf.embedPng(barcodePng);
    pages[(i * 2) + 1].drawImage(barcode, {
        x: (width - 50 * (width / standardWidth)) / 2,
        y: height - (48 * (height / standardHeight)),
        width: 50 * (width / standardWidth),
        height: 6 * (height / standardHeight),
    });


    pages[(i * 2) + 1].drawText(user.stud_id, {
        x: (width - 0.5 * getStringWidth(user.stud_id, 7)) / 2,
        y: height - (51 * (height / standardHeight)),
        size: 7,
        font: bahnschrift,
        color: PDFLib.rgb(0, 0, 0),
    });
}

function getStringWidth(string, fontSize) {
    return string
        .split('')
        .map((c) => c.charCodeAt(0))
        .map((c) => bahnschrift.embedder.font.glyphForCodePoint(c).advanceWidth * (fontSize / 1000))
        .reduce((total, width) => total + width, 0);
}

async function createBarcode(content) {
    JsBarcode("#barcode", content, {
        format: "CODE128",
        lineColor: "#000",
        width: 10,
        height: 100,
        displayValue: false
    });
    const barcodePng = await svgToPng(document.getElementById("barcode").outerHTML);
    return barcodePng;
}

async function createIDs() {
    console.log('Start creating IDs');
    statusText.innerHTML = 'Nutzerdaten werden heruntergeladen';

    let { data: verifiedPictures, error } = await supabase
        .from('verified_pictures')
        .select('*')
        .eq('status', 'ACCEPTED');

    for (let i = 0; i < verifiedPictures.length; i++) {
        let { data: user } = await supabase
            .from('users')
            .select("*")
            .eq('id', verifiedPictures[i].user_id);
        verifiedPictures[i].class = user[0].class_id
    }

    verifiedPictures.sort((a, b) => {
        return a.class.localeCompare(b.class)
    })

    let lastClass = verifiedPictures[0].class;
    let users = [];
    for (let i = 0; i < verifiedPictures.length; i++) {
        let currentClass = verifiedPictures[i].class;
        if (currentClass !== lastClass) {
            let { data: classData } = await supabase
                .from('classes')
                .select('*')
                .eq('id', lastClass);

            await createIDsForClass(users, classData[0].name, null);

            users = [];
            lastClass = currentClass;
        }
        users.push(verifiedPictures[i].user_id)
    }
    let { data: classData } = await supabase
        .from('classes')
        .select('*')
        .eq('id', lastClass);

    await createIDsForClass(users, classData[0].name, null);
    alert("Fertig")
}

async function result(userID, pictureID, status, rejectionReason) {
    const { data, error } = await supabase
        .from('verified_pictures')
        .upsert({ picture_id: pictureID, user_id: userID, status: status, rejection_reason: rejectionReason })
        .select()
    if (error) console.warn(error)
}

async function showSite(i, pictureList) {
    if (i >= pictureList.length) { app.innerHTML = "Fertig"; return; }
    if (!pictureList[i]) { showSite(i + 1, pictureList); return; }

    const { data: file, error: fileError } = await supabase
        .storage
        .from('pictures')
        .download(`${pictureList[i].user_id}/${pictureList[i].picture_id}.jpg`)
    if (fileError) {
        console.warn(fileError);
        showSite(i + 1, pictureList);
    }

    let imageUrl = URL.createObjectURL(file);
    let frame = pictureList[i].frame
    let width = pictureList[i].size[0]
    let height = pictureList[i].size[1]

    app.innerHTML = `
    <img src="${imageUrl}" style="position: absolute; top: ${-(62.5 / frame[3]) * frame[1]}vw; left: ${-(50 / frame[2]) * frame[0]}vw; height: ${(62.5 / frame[3]) * height}vw; width: ${((50 / frame[2]) * width)}vw; clip-path: polygon(${(frame[0] / width) * 100}% ${(frame[1] / height) * 100}%, ${((frame[2] + frame[0]) / width) * 100}% ${(frame[1] / height) * 100}%, ${((frame[2] + frame[0]) / width) * 100}% ${((frame[3] + frame[1]) / height) * 100}%, ${((frame[0] / width) * 100)}% ${((frame[3] + frame[1]) / height) * 100}%);">
    <div style="border: solid 2px black; position: absolute; top: 0; left: 0; height: calc(62.5vw - 2px); width: calc(50vw - 2px);");></div>
    <div style="position: absolute; left: 1em; top: 75vw;">
    <button id="resize">Neu zuschneiden</button>
    <p>UUID: ${pictureList[i].user_id}</p>
    </div>
    
    <div style="position: absolute; top: 1em; right: 1em;">
    <button id="accept" style="color: green">Gehnehmigt</button>
    <br>
    <br>
    <br>
    <button id="clarification" style="color: yellow">Klärung</button>
    <br>
    <br>
    <br>
    <button id="reject-group" style="color: red">Gruppenfoto</button>
    <br>
    <br>
    <button id="reject-filter" style="color: red">Foto-Filter</button>
    <br>
    <br>
    <button id="reject-accessoires" style="color: red">Accessoires</button>
    <br>
    <br>
    <button id="reject-blurred" style="color: red">Unscharf</button>
    <br>
    <br>
    <button id="reject-shaky" style="color: red">Verwackelt</button>
    <br>
    <br>
    <br>
    <button id="back" style="color: black">Zurück</button>
    <button id="skip" style="color: black">Überspringen</button>
    <button id="skip-20" style="color: black">20 Überspringen</button>
    </div>`
    if (pictureList[i].crop_disabled) app.innerHTML += '<p style="position: absolute; top: 70vw;">Bild wurde nicht zugeschnitten</p>'
    document.getElementById("resize").addEventListener("click", async () => { cropPhoto(await blobToImage(await file), i, pictureList) })
    document.getElementById("accept").addEventListener("click", () => { result(pictureList[i].user_id, pictureList[i].picture_id, "ACCEPTED", null); showSite(i + 1, pictureList); })
    document.getElementById("clarification").addEventListener("click", () => { result(pictureList[i].user_id, pictureList[i].picture_id, "CLARIFICATION", null); showSite(i + 1, pictureList); })
    document.getElementById("reject-group").addEventListener("click", () => { result(pictureList[i].user_id, pictureList[i].picture_id, "REJECTED", "Keine Gruppenfotos"); showSite(i + 1, pictureList); })
    document.getElementById("reject-filter").addEventListener("click", () => { result(pictureList[i].user_id, pictureList[i].picture_id, "REJECTED", "Keine Filter"); showSite(i + 1, pictureList); })
    document.getElementById("reject-accessoires").addEventListener("click", () => { result(pictureList[i].user_id, pictureList[i].picture_id, "REJECTED", "Keine Accessoires"); showSite(i + 1, pictureList); })
    document.getElementById("reject-blurred").addEventListener("click", () => { result(pictureList[i].user_id, pictureList[i].picture_id, "REJECTED", "Unscharf"); showSite(i + 1, pictureList); })
    document.getElementById("reject-shaky").addEventListener("click", () => { result(pictureList[i].user_id, pictureList[i].picture_id, "REJECTED", "Verwackelt"); showSite(i + 1, pictureList); })
    document.getElementById("back").addEventListener("click", () => { showSite(i - 1, pictureList); })
    document.getElementById("skip").addEventListener("click", () => { showSite(i + 1, pictureList); })
    document.getElementById("skip-20").addEventListener("click", () => { showSite(i + 20, pictureList); })
}

async function classify() {
    let { data: pictureList, error: pictureListError } = await supabase
        .from('picture_list')
        .select()
        .order('user_id', { ascending: false })
        .order('created_at', { ascending: false });
    if (pictureListError) {
        console.warn(pictureListError);
        return;
    }

    console.log(pictureList)

    const { data: verified, error: verifiedError } = await supabase
        .from('verified_pictures')
        .select()
    if (verifiedError) {
        console.warn(verifiedError);
        showError();
        return;
    }

    let lastID;

    outer:
    for (let j = 0; j < pictureList.length; j++) {
        if (!pictureList[j]) continue;
        if (pictureList[j].user_id === lastID) {
            delete pictureList[j];
            continue outer;
        }
        lastID = pictureList[j].user_id
        for (let i = 0; i < verified.length; i++) {
            if (pictureList[j].picture_id === verified[i].picture_id) {
                if (verified[i].status !== 'UPLOADED') {
                    delete pictureList[j];
                }
                continue outer;
            }
        };
    }

    const app = document.getElementById("app")

    showSite(0, pictureList)
}

async function getRejected() {
    let { data: rejectedPictures, error } = await supabase
        .from('verified_pictures')
        .select('*')
        .eq('status', 'REJECTED');

    let returnString = '';
    for (let i = 0; i < rejectedPictures.length; i++) {
        let userID = rejectedPictures[i].user_id
        let { data: pictureList, picListError } = await supabase
            .from('picture_list')
            .select('*')
            .eq('user_id', userID)
            .order('created_at', { ascending: false });
        let { data: verifiedPictures, error } = await supabase
            .from('verified_pictures')
            .select('*')
            .eq('picture_id', pictureList[0].picture_id);
        if (verifiedPictures[0].status === 'REJECTED') {
            let { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', userID);
            user = user[0]
            let { data: classData, classError } = await supabase
                .from('classes')
                .select('*')
                .eq('id', user.class_id);
            classData = classData[0]
            returnString += `${user.public_id},${user.first_name},${user.last_name},${classData.name},${new Date(pictureList[0].created_at).toLocaleString("de-DE")}<br>`
        }
    }
    document.getElementById('rejected-list').innerHTML = returnString;
}

function importSchool() {
    console.log("Import school")
    document.getElementById("import-school-fields").innerHTML = '<input id="import-school-input" type="file"><br><input type="text" placeholder="Schul-ID" id="school-id"><br><button id="import-school-upload">Hochladen</button>'
    document.getElementById("import-school-upload").addEventListener("click", () => {
        let csv = document.getElementById("import-school-input").files[0]
        const reader = new FileReader()
        reader.onload = async (e) => {
            let schoolId = document.getElementById("school-id").value
            /*let { data, error } = await supabase
                .from('classes')
                .select('*')
                .eq("school_id", schoolId)*/
            csv = e.target.result
            csv = csv.split("\n")
            csv = csv.slice(1, csv.length)
            for (let i = 0; i < csv.length; i++) {
                csv[i] = csv[i].split(",");
                for (let j = 0; j < csv[i].length; j++) {
                    csv[i][j] = csv[i][j].substr(1, csv[i][j].length - 2);
                }
            }
            console.log(csv)
            for (let i = 0; i < csv.length; i++) {
                const { data: classes, error: classError } = await supabase
                    .from('classes')
                    .select('*')
                    .eq("school_id", schoolId)
                    .eq("name", csv[i][6])
                if (classError) return;
                let classID = null;
                if (classes.length === 0) {
                    const { error } = await supabase
                        .from('classes')
                        .insert([
                            { name: csv[i][6], school_id: schoolId },
                        ])
                        .select()
                    if (error) return;
                    const { data: newClasses, error: ncError } = await supabase
                        .from('classes')
                        .select('*')
                        .eq("school_id", schoolId)
                        .eq("name", csv[i][6])
                    if (ncError) return;
                    classID = newClasses[0].id
                } else {
                    classID = classes[0].id
                }
                const { data: user, error: userError } = await supabase.auth.admin.createUser({
                    email: csv[i][0] + '@lama-id.de',
                    password: new Date(csv[i][5]).toLocaleDateString('de-DE', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                    }),
                    email_confirm: true
                })
                if (userError) {
                    return;
                }
                let userId = user.user.id
                const { error } = await supabase
                    .from('users')
                    .insert([
                        { id: userId, public_id: csv[i][0], school_id: schoolId, class_id: classID, first_name: csv[i][4], last_name: csv[i][3], birthdate: csv[i][5], stud_id: csv[i][2], valid_date: csv[i][8], delete_date: csv[i][11] },
                    ])
                    .select()
                if (error) return;
            }
        }
        reader.readAsText(csv)
    })
}

async function logUserIn() {
    supabase = await createClient(supabaseUrl, document.getElementById("service-key").value)
    document.getElementById('login-div').style.display = 'none';
    console.log('Supabase client started', supabase)
    /*const { data: user, error: userError } = await supabase.auth.admin.createUser({
        email: 'classifier@lama-id.de',
        password: '',
        email_confirm: true,
        role: 'classifier'
    })*/
}

async function logEmailIn() {
    supabase = await createClient(supabaseUrl, supabaseKey)
    const { data, error } = await supabase.auth.signInWithPassword({
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
    });
    console.log(data.user.role)
    document.getElementById('login-div').style.display = 'none';
    console.log('Supabase client started', supabase)
}


document.getElementById("login").addEventListener("click", logUserIn)
document.getElementById("login-email").addEventListener("click", logEmailIn)
document.getElementById("import-school").addEventListener("click", importSchool)
document.getElementById("create-pdfs").addEventListener("click", createIDs)
document.getElementById("start-classification").addEventListener("click", classify)
document.getElementById("get-rejected").addEventListener("click", getRejected)