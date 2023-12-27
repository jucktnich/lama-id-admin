import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const supabaseUrl = 'https://bgedbgapfrskjgvhcptz.supabase.co'
let supabase;

const idPdfBytes = await fetch('id_schueler.pdf').then((res) => res.arrayBuffer());
const bahnschriftBytes = await fetch('bahnschrift-SemiLight.ttf').then((res) => res.arrayBuffer());
const standardWidth = 86.6; const standardHeight = 55;
let width, height, bahnschrift;

const appEle = document.getElementById("app")

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

function importSchool() {
    document.getElementById("import-school-fields").innerHTML = '<input id="import-school-input" type="file"><br><input type="text" placeholder="Schul-ID" id="school-id"><br><button id="import-school-upload">Hochladen</button>'
    document.getElementById("import-school-upload").addEventListener("click", () => {
        let csv = document.getElementById("import-school-input").files[0]
        const reader = new FileReader()
        reader.onload = async (e) => {
            let schoolId = document.getElementById("school-id").value
            let { data, error } = await supabase
                .from('classes')
                .select('*')
                .eq("school", schoolId)
            csv = e.target.result
            csv = csv.split("\n")
            csv = csv.slice(1, -1)
            for (let i = 0; i < csv.length; i++) {
                csv[i] = csv[i].split(";")
            }
            for (let i = 0; i < csv.length; i++) {
                let { data: classes } = await supabase
                    .from('classes')
                    .select('*')
                    .eq("school", schoolId)
                    .eq("name", csv[i][4])
                let classID = null;
                if (classes.length === 0) {
                    await supabase
                        .from('classes')
                        .insert([
                            { name: csv[i][4], school: schoolId },
                        ])
                        .select()
                    let { data: newClasses } = await supabase
                        .from('classes')
                        .select('*')
                        .eq("school", schoolId)
                        .eq("name", csv[i][4])
                    classID = newClasses[0].id
                } else {
                    classID = classes[0].id
                }
                let { data: user } = await supabase.auth.admin.createUser({
                    email: csv[i][5] + '@lama-id.de',
                    password: csv[i][6],
                    email_confirm: true
                })
                let userId = user.user.id
                await supabase
                    .from('users')
                    .insert([
                        { id: userId, public_id: csv[i][5], school_id: schoolId, class: classID, first_name: csv[i][2], last_name: csv[i][1], birthdate: csv[i][3], stud_id: csv[i][0] },
                    ])
                    .select()
            }
        }
        reader.readAsText(csv)
    })
}

async function logUserIn() {
    supabase = createClient(supabaseUrl, document.getElementById("password").value)
    document.getElementById('login-div').style.display = 'none';
    console.log('Supabase client started', supabase)
    createID('f5d9921a-c194-4d5c-8043-4aabb3fd2139', '')
}

document.getElementById("login").addEventListener("click", logUserIn)
document.getElementById("import-school").addEventListener("click", importSchool)