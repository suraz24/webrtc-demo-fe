import { getTURNCredentials } from "./api";

let TURNIceServers = null;

export const fetchTURNCredentials = async () => {
    const responseData = await getTURNCredentials();

    if(responseData.token?.iceServers){
        TURNIceServers = responseData.token.iceServers;
    }

    return TURNIceServers;
}

export const getTurnIceServers = () => {
    return TURNIceServers;
}