import { supabase } from './supabase.js';
import { uuidv4, formatDate } from './helpers.js';

function stringToDate(str) {
    let dmy = str.split(".");
    return new Date(`${dmy[2]}-${dmy[1]}-${dmy[0]}`);
    //return new Date(dmy[2], dmy[1] - 1, dmy[0]);
}

async function importSchool(csv, schoolID, campaignID, uniqueExternalID) {
    let users = parseSchoolCSV(csv);
    let groups = await downloadGroups(campaignID);

    let printCSV = 'id;birthdate;lastName;firstName;class';

    for (let i = 0; i < users.length; i++) {
        let user = users[i];
        let userID = await getUserID(user, schoolID, uniqueExternalID);
        const { error } = await supabase
            .from('users')
            .upsert([
                {
                    id: userID,
                    school_id: schoolID,
                    public_id: user.publicID,
                    external_id: user.externalID,
                    first_name: user.firstName,
                    last_name: user.lastName,
                    birthdate: user.birthdate.toISOString(),
                    delete_date: user.deleteDate.toISOString(),
                    searchable_birthdate: formatDate(user.birthdate)
                },
            ])
            .select()
        if (error) return;

        let groupID;
        for (let i = 0; i < groups.length; i++) {
            if (groups[i].name === user.class) {
                groupID = groups[i].id;
                break;
            }
        }

        if (groupID === undefined) {
            groupID = uuidv4()
            const { error } = await supabase
                .from('groups')
                .insert([
                    { id: groupID, name: user.class, parent_group: groups[0].id },
                ])
                .select()
            if (error) return;
            groups.push({ id: groupID, name: user.class, parent_group: groups[0].id })
        }

        const { ucError } = await supabase
            .from('user_campaign')
            .insert([
                { user_id: userID, campaign_id: campaignID, group_id: groupID, valid_date: user.validDate.toISOString(), paid: false },
            ])
            .select()
        if (ucError) return;

        printCSV += `\n${'' + schoolID + user.publicID};${formatDate(user.birthdate)};${user.lastName};${user.firstName};${user.class}`
    }
    console.log(printCSV)
}

function parseSchoolCSV(csv) {
    csv = csv.split('\n')
    csv = csv.slice(1, csv.length - 1)
    for (let i = 0; i < csv.length; i++) {
        csv[i] = csv[i].split(';');
        /*for (let j = 0; j < csv[i].length; j++) {
            csv[i][j] = csv[i][j].substr(1, csv[i][j].length - 2);
        }*/
        /*let user = {
            externalID: csv[i][0],
            lastName: csv[i][1],
            firstName: csv[i][2],
            birthdate: new Date(csv[i][3]),
            class: csv[i][4],
            validDate: new Date(csv[i][5]),
            deleteDate: new Date(csv[i][6])
        }*/
        let user = {
            externalID: csv[i][4],
            lastName: csv[i][1],
            firstName: csv[i][2],
            birthdate: stringToDate(csv[i][3]),
            class: csv[i][0],
            validDate: new Date('2028-07-31'),
            deleteDate: new Date('2031-07-31')
        }
        csv[i] = user
    }
    console.log(formatDate(csv[0].birthdate))
    return csv;
}

async function downloadGroups(campaignID) {
    let { data: groups, error: error } = await supabase
        .from('groups')
        .select('*')
        .eq('campaign', campaignID);
    if (error) throw new Error();
    let addedGroups = groups;

    while (addedGroups.length > 0) {
        let newAddedGroups = [];
        for (let i = 0; i < addedGroups.length; i++) {
            const { data: groups, error: error } = await supabase
                .from('groups')
                .select('*')
                .eq('parent_group', addedGroups[i].id);
            if (error) throw new Error();
            newAddedGroups.concat(groups);
        }
        groups.concat(newAddedGroups);
        addedGroups = newAddedGroups;
    }
    return groups;
}

async function getUserID(user, schoolID, uniqueExternalID) {
    let userEntry;
    if (uniqueExternalID) {
        const { data: constUserEntry, error: error } = await supabase
            .from('users')
            .select('*')
            .eq('school_id', schoolID)
            .eq('external_id', user.externalID);
        if (error) throw new Error();
        userEntry = constUserEntry;
        user.publicID = user.externalID;
    } else {
        const { data: constUserEntry, error: error } = await supabase
            .from('users')
            .select('*')
            .eq('school_id', schoolID)
            .eq('first_name', user.firstName)
            .eq('last_name', user.lastName)
            .eq('birthdate', user.birthdate.toISOString());
        if (error) throw new Error();
        userEntry = constUserEntry;
        if (userEntry.length === 0) {
            while (user.publicID === undefined) {
                let rand = Math.floor(Math.random() * 1000000);
                const { data: userIDTest, error: error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('school_id', schoolID)
                    .eq('public_id', rand)
                if (error) throw new Error();
                if (userIDTest.length === 0) user.publicID = rand;
            }
            if (error) return;
        } else if (userEntry.length === 1) {
            user.publicID = userEntry[0].public_id;
        }
    }

    if (userEntry.length === 0) {
        return createUser(schoolID, user.publicID, user.birthdate);
    } else if (userEntry.length === 1) {
        return userEntry[0].id
    } else {
        console.error('No unique entry for', user);
        throw new Error();
    }
}

async function createUser(schoolID, publicID, birthdate) {
    const { data: userData, error: error } = await supabase.auth.admin.createUser({
        email: schoolID + publicID + '@external.users.lama-id.de',
        password: formatDate(birthdate),
        email_confirm: true
    })
    if (error) throw new Error();
    return userData.user.id;
}

export default async function (csv, schoolID, campaignID, uniqueExternalID = false) {
    console.log('Importing school');
    await importSchool(csv, schoolID, campaignID, uniqueExternalID);
    console.log('School import finished');
}
