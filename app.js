import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabaseUrl = 'https://supabase.lama-id.de'
let supabase;

const idPdfBytes = await fetch('id_schueler.pdf').then((res) => res.arrayBuffer());
const bahnschriftBytes = await fetch('bahnschrift-SemiLight.ttf').then((res) => res.arrayBuffer());
const standardWidth = 86.6; const standardHeight = 55;
let width, height, bahnschrift;

const appEle = document.getElementById("app")

function picFinished(pic, frame, size) {
    console.log("Cropping of the picture finished");


}

function closeCanvas() {
    console.log('Closing canvas')
    document.getElementById("crop-canvas").remove()
    document.getElementById("pic-border-container").remove()
    document.body.style.overflowY = 'scroll'
    document.body.style.position = 'relative'
    document.body.style.touchAction = 'auto'
}

function cropPhoto(pic) {
    document.querySelector('[id^="b_1urq61qi_"]').children[0].style.zIndex = '990';
    document.body.style.overflowY = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.touchAction = 'none'

    window.addEventListener("resize", () => {
        if (document.getElementById("crop-canvas")) {
            closeCanvas();
            cropPhoto(pic);
        }
    })

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    let vh = windowHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    console.log(windowHeight, windowWidth)

    appEle.innerHTML += '<canvas id="crop-canvas"></canvas><div class="center-content" id="pic-border-container"><div id="pic-border"></div><button id="pic-border-btn">OK</button></div>'
    const borderDims = document.getElementById("pic-border").getBoundingClientRect();
    document.getElementById("pic-border-btn").addEventListener('click', () => {
        /*let left = (windowWidth - boxDims.width) / 2;
        let right = left + boxDims.width;
        let top = (windowHeight - boxDims.height) / 2;
        let bottom = top + boxDims.height;*/
        /*let leftPic = (pic.width / 2) - ((boxDims.left - (cameraOffset.x*cameraZoom))/* / cameraZoom*//*)
        let topPic = (pic.height / 2) - ((boxDims.top - (cameraOffset.y*cameraZoom))/* / cameraZoom*///)
        //let leftPic = (((pic.width * cameraZoom) / 2) - (cameraOffset.x / cameraZoom - borderDims.x)) / cameraZoom
        //let leftPic = -(((cameraOffset.x - windowWidth / 2) / cameraZoom) + (pic.width * cameraZoom - borderDims.width) / 2) * cameraZoom
        //let topPic = (((pic.height * cameraZoom) / 2) - (cameraOffset.y - borderDims.y)) / cameraZoom
        let leftPic = ((((windowWidth / 2) - cameraOffset.x) * cameraZoom) - (((windowWidth / 2) - borderDims.left) - ((pic.width * cameraZoom) / 2))) / cameraZoom
        let topPic = ((((windowHeight / 2) - cameraOffset.y) * cameraZoom) - (((windowHeight / 2) - borderDims.top) - ((pic.height * cameraZoom) / 2))) / cameraZoom
        let rightPic = borderDims.width / cameraZoom
        let bottomPic = borderDims.height / cameraZoom
        //let topPic = (((cameraOffset.y - windowHeight / 2) / cameraZoom) + (pic.height * cameraZoom - borderDims.height) / 2) * cameraZoom
        //let rightPic = (pic.width - (((((pic.width * cameraZoom) / 2) + cameraOffset.x) - (borderDims.right)) / cameraZoom)) - leftPic
        //let bottomPic = (pic.height - (((((pic.height * cameraZoom) / 2) + cameraOffset.y) - (borderDims.bottom)) / cameraZoom)) - topPic
        closeCanvas()
        console.log([leftPic, topPic, rightPic, bottomPic], [pic.width, pic.height], cameraZoom, borderDims, cameraOffset, pic)
        picFinished(pic, [leftPic, topPic, rightPic, bottomPic], [pic.width, pic.height])
    })

    let canvas = document.getElementById("crop-canvas")
    let ctx = canvas.getContext('2d')

    let cameraOffset = { x: windowWidth / 2, y: windowHeight / 2 }
    let cameraZoom = 1
    let MAX_ZOOM = 5
    let MIN_ZOOM = 0
    let SCROLL_SENSITIVITY = 0.0005

    if ((pic.width / pic.height) < 24 / 35) {
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

function uuidv4() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
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

async function createID(userID, preprint) {
    let { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq("id", userID)
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
        .eq("id", user.class)
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

    const { data: file, error: fileError } = await supabase.storage
        .from('pictures')
        .download(picture.user_id + '/' + picture.picture_id + '.png');
    if (fileError) {
        console.error(picError)
        throw new Error(`Supabase error downloading picture data: ${userID}`);
    }


    const idPdf = await PDFLib.PDFDocument.load(idPdfBytes);
    idPdf.registerFontkit(fontkit)
    bahnschrift = await idPdf.embedFont(bahnschriftBytes)
    let pages = idPdf.getPages()
    width = pages[0].getSize().width
    height = pages[0].getSize().height

    const image = await idPdf.embedPng(await file.arrayBuffer())
    pages[0].drawImage(image, {
        x: 4.035 * (width / standardWidth),
        y: height - (44.793 * (height / standardHeight)),
        width: 24 * (width / standardWidth),
        height: 30 * (height / standardHeight),
    })

    drawText(pages[0], 'Test', 45.733, 17.771)
    drawText(pages[0], user.last_name.substring(0, 19), 40.822, 25.706)
    drawText(pages[0], user.first_name.substring(0, 19), 45.189, 33.628)
    drawText(pages[0], user.birthdate.substring(0, 19), 52.596, 41.824)

    JsBarcode("#barcode", user.stud_id, {
        format: "CODE128",
        lineColor: "#000",
        width: 10,
        height: 100,
        displayValue: false
    });
    const barcodePng = await svgToPng(document.getElementById("barcode").outerHTML);
    const barcode = await idPdf.embedPng(barcodePng)
    pages[1].drawImage(barcode, {
        x: (width - 50 * (width / standardWidth)) / 2,
        y: height - (48 * (height / standardHeight)),
        width: 50 * (width / standardWidth),
        height: 6 * (height / standardHeight),
    })

    const getStringWidth = (string, fontSize) =>
        string
            .split('')
            .map((c) => c.charCodeAt(0))
            .map((c) => bahnschrift.embedder.font.glyphForCodePoint(c).advanceWidth * (fontSize / 1000))
            .reduce((total, width) => total + width, 0);
    pages[1].drawText(user.stud_id, {
        x: (width - 0.5 * getStringWidth(user.stud_id, 7)) / 2,
        y: height - (51 * (height / standardHeight)),
        size: 7,
        font: bahnschrift,
        color: PDFLib.rgb(0, 0, 0),
    })


    const pdfDataUri = await idPdf.saveAsBase64({ dataUri: true });
    window.location = pdfDataUri;

    /*const link = document.createElement("a");
    link.href = pdfDataUri;
    link.download = user.class_name + '_' + user.last_name + '-' + user.first_name + '.pdf';
    link.click();*/
}

async function createPDFs() {
    console.log("Create PDFs");
    const { data: schools, error: schoolsError } = await supabase
        .from('schools')
        .select('* classes: ')
    console.log(schools)
    document.getElementById("create-pdfs-fields").innerHTML = `
    <ul>`;
}

async function result(userID, pictureID, status, rejectionReason) {
    const { data, error } = await supabase
        .from('verified_pictures')
        .upsert({ picture_id: pictureID, user_id: userID, status: status, rejection_reason: rejectionReason })
        .select()
    if(error) console.warn(error)
}

async function showSite(i, pictureList) {
    if (i === (pictureList.length - 1)) { app.innerHTML = "Fertig"; return; }
    if (!pictureList[i]) { showSite(i + 1, pictureList); return; }

    const { data: file, error: fileError } = await supabase
        .storage
        .from('pictures')
        .download(`${pictureList[i].user_id}/${pictureList[i].picture_id}.jpg`)
    if (fileError) {
        console.warn(fileError);
        showError();
        showSite(i + 1, pictureList);
    }

    let imageUrl = URL.createObjectURL(file);
    let frame = pictureList[i].frame
    let width = pictureList[i].size[0]
    let height = pictureList[i].size[1]

    app.innerHTML = `
    <img src="${imageUrl}" style="position: absolute; top: ${-(72.9 / frame[3]) * frame[1]}vw; left: ${-(50 / frame[2]) * frame[0]}vw; height: ${(72.9 / frame[3]) * height}vw; width: ${((50 / frame[2]) * width)}vw; clip-path: polygon(${(frame[0] / width) * 100}% ${(frame[1] / height) * 100}%, ${((frame[2] + frame[0]) / width) * 100}% ${(frame[1] / height) * 100}%, ${((frame[2] + frame[0]) / width) * 100}% ${((frame[3] + frame[1]) / height) * 100}%, ${((frame[0] / width) * 100)}% ${((frame[3] + frame[1]) / height) * 100}%);">
    <div style="border: solid 2px black; position: absolute; top: 0; left: 0; height: calc(72.9vw - 2px); width: calc(50vw - 2px);");></div>
    <button style="position: absolute; left: 1em; top: 75vw;" id="resize">Neu zuschneiden</button>
    
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
    </div>`
    //document.getElementById("resize").addEventListener("click")
    document.getElementById("accept").addEventListener("click", () => { result(pictureList[i].user_id, pictureList[i].picture_id, "ACCEPTED", null); showSite(i + 1, pictureList); })
    document.getElementById("clarification").addEventListener("click", () => { result(pictureList[i].user_id, pictureList[i].picture_id, "CLARIFICATION", null); showSite(i + 1, pictureList); })
    document.getElementById("reject-group").addEventListener("click", () => { result(pictureList[i].user_id, pictureList[i].picture_id, "REJECTED", "Keine Gruppenfotos"); showSite(i + 1, pictureList); })
    document.getElementById("reject-filter").addEventListener("click", () => { result(pictureList[i].user_id, pictureList[i].picture_id, "REJECTED", "Keine Filter"); showSite(i + 1, pictureList); })
    document.getElementById("reject-accessoires").addEventListener("click", () => { result(pictureList[i].user_id, pictureList[i].picture_id, "REJECTED", "Keine Accessoires"); showSite(i + 1, pictureList); })
    document.getElementById("reject-blurred").addEventListener("click", () => { result(pictureList[i].user_id, pictureList[i].picture_id, "REJECTED", "Unscharf"); showSite(i + 1, pictureList); })
    document.getElementById("reject-shaky").addEventListener("click", () => { result(pictureList[i].user_id, pictureList[i].picture_id, "REJECTED", "Verwackelt"); showSite(i + 1, pictureList); })
}

async function classify() {
    let { data: pictureList, error: pictureListError } = await supabase
        .from('picture_list')
        .select()
        .order('user_id', { ascending: false })
        .order('created_at', { ascending: false });
    if (pictureListError) {
        console.warn(pictureListError);
        showError();
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
    for (let i = 0; i < verified.length; i++) {
        for (let j = 0; j < pictureList.length; j++) {
            if (!pictureList[j]) continue;
            if (pictureList[j].user_id === lastID) {
                delete pictureList[j];
                continue outer;
            }
            lastID = pictureList[j].user_id
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
    supabase = createClient(supabaseUrl, document.getElementById("password").value)
    document.getElementById('login-div').style.display = 'none';
    console.log('Supabase client started', supabase)
}

document.getElementById("login").addEventListener("click", logUserIn)
document.getElementById("import-school").addEventListener("click", importSchool)
document.getElementById("create-pdfs").addEventListener("click", createPDFs)
document.getElementById("start-classification").addEventListener("click", classify)