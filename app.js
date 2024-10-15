import { supabase, logUserInScript } from './supabase.js'
import { uuidv4, formatDate } from './helpers.js';
import { blobToImage } from './imageHelpers.js';
import createIDs from './createIDs.js';
import importSchool from './importSchool.js'


const appEle = document.getElementById("app");

async function picFinished(pic, frame, size, i, pictureList) {
    console.log('Cropping of the picture finished');
    const { data, error } = await supabase
        .from('pictures')
        .update({ frame: frame, size: size, crop_disabled: false, original_state: pictureList[i] })
        .eq('id', pictureList[i].id)
        .select()
    if (error) console.error(error);
    pictureList[i].frame = frame;
    pictureList[i].size = size;
    showClassificationSite(pictureList, i);
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

async function result(pictureID, status, rejectionReason) {
    const { error } = await supabase
        .from('pictures')
        .update({ status: status, rejection_reason: rejectionReason })
        .select()
        .eq('id', pictureID);
    if (error) console.warn(error)
}

async function showClassificationSite(pictures, i) {
    if (i >= pictures.length) { app.innerHTML = 'Fertig'; return; }
    if (!pictures[i]) { showClassificationSite(pictures, i + 1); return; }

    const { data: file, error: fileError } = await supabase
        .storage
        .from('pictures')
        .download(`${pictures[i].user_id}/${pictures[i].id}.jpg`)
    if (fileError) {
        console.warn(fileError);
        showClassificationSite(pictures, i + 1);
    }

    let imageUrl = URL.createObjectURL(file);
    let frame = pictures[i].frame
    let width = pictures[i].size[0]
    let height = pictures[i].size[1]

    app.innerHTML = `
    <img src="${imageUrl}" style="position: absolute; top: ${-(62.5 / frame[3]) * frame[1]}vw; left: ${-(50 / frame[2]) * frame[0]}vw; height: ${(62.5 / frame[3]) * height}vw; width: ${((50 / frame[2]) * width)}vw; clip-path: polygon(${(frame[0] / width) * 100}% ${(frame[1] / height) * 100}%, ${((frame[2] + frame[0]) / width) * 100}% ${(frame[1] / height) * 100}%, ${((frame[2] + frame[0]) / width) * 100}% ${((frame[3] + frame[1]) / height) * 100}%, ${((frame[0] / width) * 100)}% ${((frame[3] + frame[1]) / height) * 100}%);">
    <div style="border: solid 2px black; position: absolute; top: 0; left: 0; height: calc(62.5vw - 2px); width: calc(50vw - 2px);");></div>
    <div style="position: absolute; left: 1em; top: 75vw;">
    <button id="resize">Neu zuschneiden</button>
    <p>UUID: ${pictures[i].user_id}</p>
    </div>
    
    <div style="position: absolute; top: 1em; right: 1em;">
    <button id="accept" style="background-color: green; color: white;">Akzeptieren</button>
    <br>
    <br>
    <br>
    <button id="clarification" style="background-color: yellow; color: black;">Klärung</button>
    <br>
    <br>
    <br>
    <button id="reject" style="background-color: red; color: white;">Ablehnen</button>
    <br>
    <input id="rejection-reason" type="text" placeholder="Begründung" />
    <br>
    <br>
    <br>
    <button id="back">Zurück</button>
    <button id="skip">Überspringen</button>
    <button id="skip-20">20 Überspringen</button>
    </div>`
    if (pictures[i].crop_disabled) app.innerHTML += '<p style="position: absolute; top: 70vw;">Bild wurde nicht zugeschnitten</p>'
    document.getElementById("resize").addEventListener("click", async () => { cropPhoto(await blobToImage(await file), i, pictures) })
    document.getElementById("accept").addEventListener("click", () => { result(pictures[i].id, 'ACCEPTED', null); showClassificationSite(pictures, i + 1); })
    document.getElementById("clarification").addEventListener("click", () => { result(pictures[i].id, 'CLARIFICATION', null); showClassificationSite(pictures, i + 1); })
    document.getElementById("reject").addEventListener("click", () => { result(pictures[i].id, 'REJECTED', document.getElementById('rejection-reason').value); showClassificationSite(pictures, i + 1); })
    document.getElementById("back").addEventListener("click", () => { showClassificationSite(pictures, i - 1); })
    document.getElementById("skip").addEventListener("click", () => { showClassificationSite(pictures, i + 1); })
    document.getElementById("skip-20").addEventListener("click", () => { showClassificationSite(pictures, i + 20); })
}

async function classify(status) {
    let { data: pictures, error: picturesError } = await supabase
        .from('pictures')
        .select()
        .eq('status', status)
        .order('created_at', { ascending: false })
        .order('user_id', { ascending: false });
    if (picturesError) {
        console.warn(picturesError);
        return;
    }

    let lastID;

    console.log(pictures)

    outer:
    for (let i = 0; i < pictures.length; i++) {
        if (!pictures[i]) continue;
        if (pictures[i].user_id === lastID) {
            delete pictures[i];
            continue outer;
        }
        lastID = pictures[i].user_id;
    }

    console.log(pictures)

    const app = document.getElementById("app")

    showClassificationSite(pictures, 0)
}

async function getRejected() {
    let { data: rejectedPictures, error } = await supabase
        .from('pictures')
        .select()
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
            returnString += `${user.public_id},${user.first_name},${user.last_name},${classData.name},${formatDate(pictureList[0].created_at)}<br>`
        }
    }
    document.getElementById('rejected-list').innerHTML = returnString;
}

function importSchoolScreen() {
    console.log("'Import school' screen opened")
    document.getElementById("import-school-fields").innerHTML = '<input id="import-school-input" type="file"><br><input type="text" placeholder="Schul-ID" id="school-id"><br><input type="text" placeholder="Kampagne" id="campaign-id"><br><label for="unique-id">Einmalige IDs</label><input type="checkbox" id="unique-id"><button id="import-school-upload">Hochladen</button>'
    document.getElementById("import-school-upload").addEventListener("click", () => {
        let csv = document.getElementById("import-school-input").files[0]
        const reader = new FileReader()
        reader.onload = async (e) => {
            const uniqueExternalID = document.getElementById("unique-id").checked;
            const schoolID = document.getElementById("school-id").value
            const campaignID = document.getElementById("campaign-id").value

            await importSchool(e.target.result, schoolID, campaignID, uniqueExternalID);
        }
        reader.readAsText(csv)
    })
}

function createIDsScreen() {
    createIDs('03f43047-54f9-42d2-81e8-c061f57f5dd9');
}

function createSearchString(search) {
    search = search.split(' ');
    let searchString = '';
    for (let i = 0; i < search.length - 1; i++) {
        searchString += search[i] + ' & ';
    }
    searchString += search[search.length - 1] + ':*';
    return searchString;
}

async function getUserData(search) {
    let { data: users } = await supabase
        .from('users')
        .select(`
            id,
            school_id,
            public_id,
            external_id,
            first_name,
            last_name,
            birthdate,
            schools(name),
            campaigns(id, priority)
        `)
        .textSearch('search_vector', createSearchString(search));
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        let newestCampaign = { priority: -1 };
        for (let j = 0; j < user.campaigns.length; j++) {
            const campaign = user.campaigns[j];
            if (campaign.priority > newestCampaign.priority) newestCampaign = campaign;
        }
        const { data: userCampaign } = await supabase
            .from('user_campaign')
            .select('group_id')
            .eq('user_id', user.id)
            .eq('campaign_id', newestCampaign.id);
        const { data: group } = await supabase
            .from('groups')
            .select('name')
            .eq('id', userCampaign[0].group_id);
        users[i].groupName = group[0].name;
    }
    return users;
}

async function searchForUser(search) {
    const users = await getUserData(search);
    let table = '<table><tr><th>Lama-ID</th><th>Nachname</th><th>Vorname</th><th>Gruppe</th><th>Geburtstag</th><th>Externe ID</th></tr>'
    for (let i = 0; i < users.length; i++) {
        let user = users[i]
        table += `<tr><th>${user.school_id}${user.public_id}</th><th>${user.last_name}</th><th>${user.first_name}</th><th>${user.schools.name} - ${user.groupName}</th><th>${formatDate(user.birthdate)}</th><th>${user.external_id}</th></tr>`
    }
    table += '</table>'
    document.getElementById('app').innerHTML = table
}

async function printGroupStats() {
    console.log('Print group stats')
    const { data: acceptedPictures, error: acceptedPicturesError } = await supabase
        .from('pictures')
        .select()
        .eq('status', 'ACCEPTED')
        .order('user_id');
    let { data: users, error: usersError } = await supabase
        .from('users')
        .select()
        .order('id');
        console.log(users)
    let j = 0;
    for (let i = 0; i < users.length; i++) {
        if ((j < acceptedPictures.length) && (users[i].id === acceptedPictures[j].user_id)) {
            users[i].acceptedPicture = true;
            let userID = acceptedPictures[j].user_id;
            while ((j < acceptedPictures.length) && (acceptedPictures[j].user_id === userID)) j++;
        }
        let { data: userCampaigns, error: userCampaignError } = await supabase
            .from('user_campaign')
            .select(`*, campaigns(*)`)
            .eq('user_id', users[i].id);
        userCampaigns.sort((a, b) => b.campaign.priority - a.campaign.priority);
        users[i].campaign = userCampaigns[0];
    }
    users.sort((a, b) => a.campaign.group_id.localeCompare(b.campaign.group_id));
    //users = Object.groupBy(users, ({ campaign. }) => type);
    let accepted = 0;
    let overall = 0;
    let lastGroup = users[0].campaign.group_id;
    let result = [];
    for (let i = 0; i < users.length; i++) {
        if (lastGroup !== users[i].campaign.group_id) {
            let { data: group, error: groupError } = await supabase
                .from('groups')
                .select()
                .eq('id', lastGroup);
            group.accepted = accepted;
            group.overall = overall;
            lastGroup = users[i].campaign.group_id;
            accepted = 0;
            overall = 0;
            result.push(group);
        }
        if(users[i].acceptedPicture) accepted++;
        overall++;
    }
    result.sort((a, b) => (b.accepted/b.overall) - (a.accepted/a.overall));
    console.log(result);
    let table = '<table><tr><th>Schule</th><th>Klasse</th><th>Verhältnis</th></tr>'
    for (let i = 0; i < result.length; i++) {
        let group = result[i]
        table += `<tr><th>-</th><th>${group[0].name}</th><th>${group.accepted}/${group.overall}</th></tr>`
    }
    table += '</table>'
    document.getElementById('app').innerHTML = table
}

async function logUserIn() {
    const servicekey = document.getElementById("service-key").value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    await logUserInScript(servicekey, email, password);
    document.getElementById('login-div').style.display = 'none';
    document.getElementById('app').style.display = 'block';
}

document.getElementById("login").addEventListener("click", logUserIn)
document.getElementById("import-school").addEventListener("click", importSchoolScreen)
document.getElementById("create-pdfs").addEventListener("click", createIDsScreen)
document.getElementById("start-classification").addEventListener("click", () => { classify('UPLOADED') })
document.getElementById("start-clarification-classification").addEventListener("click", () => { classify('CLARIFICATION') })
document.getElementById("group-stats").addEventListener("click", () => { printGroupStats() })