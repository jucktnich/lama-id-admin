import { supabase } from './supabase.js';
import { formatDate } from './helpers.js';
import { blobToImage, svgToPng } from './imageHelpers.js';

let styles, width, height;
let idPDFBytes, fontsData;

const statusText = document.getElementById("status-text");

async function createIDs(campaignID, config, groups) {
    const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select()
        .eq('id', campaignID);
    if (campaignsError) throw new Error();
    if (campaigns.length !== 1) throw new Error();
    styles = campaigns[0].print_styles;

    let fields = styles.fields
    const defaults = fields.defaults;
    delete fields.defaults;
    for (const key in fields) {
        let field = fields[key];
        for (const key in defaults) {
            if (field[key] === undefined) field[key] = defaults[key];
        }
        fields[key] = field;
    }
    styles.fields = fields;

    const { data: idPDFDownload, error: idPDFError } = await supabase.storage
        .from('campaign_material')
        .download(campaignID + '/preprint.pdf');
    if (idPDFError) throw new Error();
    idPDFBytes = await idPDFDownload.arrayBuffer();

    fontsData = [];
    for (let i = 0; i < styles.fonts.length; i++) {
        const fontName = styles.fonts[i];
        const { data: font, error: fontError } = await supabase.storage
            .from('fonts')
            .download(fontName + '.ttf');
        if (fontError) throw new Error();
        fontsData[fontName] = await font.arrayBuffer();
    }
    let stati = ['ACCEPTED'];
    if (config.printAll) stati.push('PRINTED')
    let { data: pictures, error } = await supabase
        .from('pictures')
        .select(`
            *,
            user_campaign(group_id, valid_date, paid)
        `)
        .in('status', stati)
        .eq('campaign_id', campaignID);
    if (error) throw new Error();
    if (pictures.length === 0) {
        console.log('No new pictures');
        return;
    }
    if (campaigns[0].payment_required) pictures = pictures.filter(picture => picture.user_campaign.paid);

    for (let i = 0; i < pictures.length; i++) {
        const { data: user } = await supabase
            .from('users')
            .select()
            .eq('id', pictures[i].user_id);
        if (user.length !== 1) throw new Error();
        pictures[i].user = user[0];
        pictures[i].user.valid_date = pictures[i].user_campaign.valid_date;
    }

    pictures.sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
    })
    pictures.sort((a, b) => {
        return a.user_id.localeCompare(b.user_id);
    })
    pictures.sort((a, b) => {
        return a.user_campaign.group_id.localeCompare(b.user_campaign.group_id);
    })

    let lastGroup = pictures[0].user_campaign.group_id;
    let groupPictures = [];
    console.log(pictures)
    for (let i = 0; i < pictures.length; i++) {
        let currentGroup = pictures[i].user_campaign.group_id;
        if (currentGroup !== lastGroup) {
        console.log(lastGroup, groups);
            if(groups.length !== 0 && (groups[0] === '*' || groups.includes(lastGroup))) {
                let { data: group } = await supabase
                    .from('groups')
                    .select('*')
                    .eq('id', lastGroup);

                await createIDsForGroup(group[0].name, groupPictures);
            }

            groupPictures = [];
            lastGroup = currentGroup;
        }
        if (groupPictures.length === 0 || pictures[i].user_id !== groupPictures.at(-1).user_id) groupPictures.push(pictures[i]);
    }
    if(groups.length !== 0 && (groups[0] === '*' || groups.includes(lastGroup))) {
    let { data: group } = await supabase
        .from('groups')
        .select('*')
        .eq('id', lastGroup);

    await createIDsForGroup(group[0].name, groupPictures);
    }
}

function createIDsForGroup(groupName, pictures) {
    if (pictures.length === 0) return;
    return new Promise(async (resolve) => {
        console.log(`Creating IDs for class ${groupName}`, pictures);
        statusText.innerHTML = `Gruppe ${groupName} wird erstellt`

        const idPDF = await PDFLib.PDFDocument.create()
        const srcPDF = await PDFLib.PDFDocument.load(idPDFBytes);
        for (let i = 0; i < pictures.length; i++) {
            const copiedPages = await idPDF.copyPages(srcPDF, [0, 1])
            idPDF.addPage(copiedPages[0])
            idPDF.addPage(copiedPages[1])
        }
        idPDF.registerFontkit(fontkit);
        let fonts = {};
        for (let i = 0; i < styles.fonts.length; i++) {
            const fontName = styles.fonts[i];
            fonts[fontName] = await idPDF.embedFont(fontsData[fontName]);
        }

        let pages = idPDF.getPages();
        width = pages[0].getSize().width;
        height = pages[0].getSize().height;

        let pictureIDs = []

        for (let i = 0; i < pictures.length; i++) {
            const picture = pictures[i];
            const userID = picture.user_id;
            console.debug('Creating ID for user', userID)
            pictureIDs.push(picture.id);

            const { data: file, error: fileError } = await supabase.storage
                .from('pictures')
                .download(picture.user_id + '/' + picture.id + '.jpg');
            if (fileError) {
                console.error(fileError)
                throw new Error(`Supabase error downloading picture data: ${userID}`);
            }

            const clippedImage = await clipImage(await blobToImage(await file), picture.frame);
            const image = await idPDF.embedJpg(clippedImage);
            pages[i * 2].drawImage(image, {
                x: styles.picture.x * (width / styles.size.width),
                y: height - (styles.picture.y * (height / styles.size.height)),
                width: styles.picture.width * (width / styles.size.width),
                height: styles.picture.height * (height / styles.size.height),
            })

            await addTextAndBarcode(idPDF, pages, i, fonts, picture.user);
        }

        const pdfDataUri = await idPDF.saveAsBase64({ dataUri: true });
        //window.location = pdfDataUri;
        
        const link = document.createElement("a");
        link.href = pdfDataUri;
        link.download = groupName + '.pdf';
        link.click();

        for (let i = 0; i < pictureIDs.length; i++) {
            const { error } = await supabase
                .from('pictures')
                .update({ status: 'PRINTED' })
                .eq('id', pictureIDs[i])
                .select();
            if (error) console.error(error);
        }

        resolve();
    })
}

async function addTextAndBarcode(idPdf, pages, i, fonts, user) {
    const fields = styles.fields
    for (const key in fields) {
        const field = fields[key]
        if(key === 'external_id') continue;
        let text = user[key];
        if(field.type === 'date') text = formatDate(text);
        drawText(pages[i * 2], text.substring(0, field.max_length), field.x, field.y, field.size, fonts[field.font]);
    }

    const barcodePng = await createBarcode(user.external_id);
    const barcode = await idPdf.embedPng(barcodePng);
    pages[(i * 2) + 1].drawImage(barcode, {
        x: (width - styles.barcode.x * (width / styles.size.width)) / 2,
        y: height - (styles.barcode.y * (height / styles.size.height)),
        width: styles.barcode.width * (width / styles.size.width),
        height: styles.barcode.height * (height / styles.size.height),
    });

    pages[(i * 2) + 1].drawText(user.external_id.toString(), {
        x: (width - 0.5 * getStringWidth(user.external_id, styles.fields.external_id.size, fonts[styles.fields.external_id.font])) / 2,
        y: height - (styles.fields.external_id.y * (height / styles.size.height)),
        size: styles.fields.external_id.size,
        font: fonts[styles.fields.external_id.font],
        color: PDFLib.rgb(0, 0, 0),
    });
}

function drawText(page, text, x, y, size, font) {
    page.drawText(text, {
        x: x * (width / styles.size.width),
        y: height - (y * (height / styles.size.height)),
        size: size,
        font: font,
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

function getStringWidth(string, fontSize, font) {
    return new String(string)
        .split('')
        .map((c) => c.charCodeAt(0))
        .map((c) => font.embedder.font.glyphForCodePoint(c).advanceWidth * (fontSize / 1000))
        .reduce((total, width) => total + width, 0);
}

async function createBarcode(content) {
    JsBarcode("#barcode", content, {
        format: styles.barcode.format,
        lineColor: styles.barcode.lineColor,
        width: 10,
        height: 100,
        displayValue: false
    });
    const barcodePng = await svgToPng(document.getElementById("barcode").outerHTML);
    return barcodePng;
}

export default async function (campaignID, config={}, groups=['*']) {
    console.log(`Start creating IDs for campaign ${campaignID}`);
    statusText.innerHTML = 'Nutzerdaten werden heruntergeladen';
    await createIDs(campaignID, config, groups);
    console.log('All IDs created');
    statusText.innerHTML = 'Fertig';
}