import { supabase } from './supabase.js';

async function getUsers() {
    const { data: pictures, error: picturesError } = await supabase
        .from('pictures')
        .select()
        //.in('status', ['ACCEPTED', 'PRINTED'])
        .order('user_id')
        .order('created_at', { ascending: false });
    if (picturesError) {
        console.error(picturesError);
        throw new Error();
    }
    let { data: users, error: usersError } = await supabase
        .from('users')
        .select()
        .order('id');
    if (usersError) {
        console.error(usersError);
        throw new Error();
    }

    let j = 0;
    for (let i = 0; i < users.length; i++) {
        if (j >= pictures.length) break;
        if (users[i].id === pictures[j].user_id) {
            users[i].status = pictures[j].status;
            const userID = users[i].id;
            while ((j < pictures.length) && (pictures[j].user_id === userID)) j++;
        }
    }
    const promises = users.map(user => supabase
        .from('user_campaign')
        .select('*, campaigns(*)')
        .eq('user_id', user.id));
    let responses = await Promise.all(promises);
    responses = responses.map(response => response.data);

    //userCampaigns.sort((a, b) => b.campaign.priority - a.campaign.priority);
    for (let i = 0; i < users.length; i++) {
        users[i].campaign = responses[i][0];
    }
    //users.sort((a, b) => a.campaign.group_id.localeCompare(b.campaign.group_id));
    users = Object.groupBy(users, (user) => user.campaign.group_id);
    console.log(users)
    return users
}

export async function getGroupStats() {
    console.log('Getting group stats');
    const users = await getUsers();
    let groups = [];
    for (const [groupID, members] of Object.entries(users)) {
        let accepted = 0;
        let overall = 0;
        for (let i = 0; i < members.length; i++) {
            if (members[i].status === 'ACCEPTED') accepted++;
            if (members[i].status !== 'PRINTED') overall++;
        }
        let { data: group, error } = await supabase
            .from('groups')
            .select()
            .eq('id', groupID)
            .single();
        if (error) {
            console.error(error);
            throw new Error();
        }
        group.accepted = accepted;
        group.overall = overall;
        groups.push(group);
    }
    groups.sort((a, b) => {
        if (a.overall === 0) return 1;
        if (b.overall === 0) return -1;
        const diff = (b.accepted / b.overall) - (a.accepted / a.overall)
        if (diff !== 0) return diff;
        return b.overall - a.overall;
    });
    console.log(groups);
    return groups;
}

export async function getUsersWithoutPic() {
    console.log('Getting user stats');
    const users = await getUsers();
    let groups = [];
    for (const [groupID, members] of Object.entries(users)) {
        let groupEntries = [];
        for (let i = 0; i < members.length; i++) {
            if (!members[i].status || members[i].status === 'REJECTED') {
                groupEntries.push(members[i]);
            }
        }
        let { data: group, error } = await supabase
            .from('groups')
            .select()
            .eq('id', groupID)
            .single();
        if (error) {
            console.error(error);
            throw new Error();
        }
        group.entries = groupEntries;
        groups.push(group);
    }
    return groups;
}