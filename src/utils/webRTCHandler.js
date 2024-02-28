import Peer from 'simple-peer';
import { setMessages, setShowOverlay } from '../store/actions';
import store from '../store/store';
import * as wss from './wss';
import { fetchTURNCredentials, getTurnIceServers } from './turn';

const defaultContraints = {
    audio: true,
    video: {
        width: "480",
        height: "360"
    },

}

const onlyAudioConstraints = {
    audio: true,
    video: false,
}

let localStream;

export const getLocalPreviewAndInitRoomConnection = async (
    isRoomHost,
    identity,
    roomId = null,
    onlyAudio
) => {

    await fetchTURNCredentials();

    const constraints = onlyAudio ? onlyAudioConstraints : defaultContraints;
    navigator.mediaDevices.getUserMedia(constraints)
     .then((stream) => {
        localStream = stream;
        showLocalVideoPreview(localStream)
        store.dispatch(setShowOverlay(false));
        isRoomHost ? wss.createRoom(identity, onlyAudio) : wss.joinRoom(roomId, identity, onlyAudio);
    })
    .catch(err => {
        console.log('Error ocured when trying to access local stream');
        console.log(err);
    })
}

let peers = {};
let streams = [];

const getConfig = () => {
    const turnIceServers = getTurnIceServers();
    console.log('turn server', turnIceServers);
    if(turnIceServers){
        return {
            iceServers: [
                {
                    urls: "stun:stun.l.google.com:19302",
                },
                ...turnIceServers
            ]
        }
    } else {
        console.warn('using only STUN servers')
        return {
            iceServers: [
                {
                    urls: "stun:stun.l.google.com:19302",
                },
            ],
        }
    }
}

const messengerChannel = 'messenger';
export const prepareNewPeerConnection = (connUserSocketId, isInitiator) => {
    const configuration = getConfig();

    peers[connUserSocketId] = new Peer({
        initiator: isInitiator,
        config: configuration,
        stream: localStream,
        channelName: messengerChannel,
    });

    //webRTC offer, webRTC answer (SDP info), ice candidates

    peers[connUserSocketId].on('signal', (data) => {
        const signalData = {
            signal: data,
            connUserSocketId,
        };

        wss.signalPeerData(signalData);
    })

    peers[connUserSocketId].on('stream', (stream) => {
        addStream(stream, connUserSocketId);
        streams = [...streams, stream];
    });

    peers[connUserSocketId].on('data', (data) => {
        const messageData = JSON.parse(data);
        appendNewMessage(messageData);
    })

}

export const handleSignalingData = (data) => {
    //add signaling data to peer connection
    peers[data.connUserSocketId].signal(data.signal);
}

export const removePeerConnection = (socketId) => {
    console.log('removing socket id:', socketId);
    const videoContainer = document.getElementById(socketId);
    const videoEl = document.getElementById(`${socketId}-video`);

    if(videoContainer && videoEl){
        const tracks = videoEl.srcObject.getTracks();
        tracks.forEach(t => t.stop());

        videoEl.srcObject = null;
        videoContainer.removeChild(videoEl);
        videoContainer.parentNode.removeChild(videoContainer);

        if(peers[socketId]) {
            peers[socketId].destroy();
        }

        delete peers[socketId];
    }
}



//************************ VIDEOS ***************************************/
const showLocalVideoPreview = (stream) => {
    const videosContainer = document.getElementById("videos_portal");
    videosContainer.classList.add("videos_portal_styles");

    const videoContainer = document.createElement('div');
    videoContainer.classList.add('video_track_container');

    const videoEl = document.createElement('video');
    videoEl.autoplay = true;
    videoEl.muted = true;
    videoEl.srcObject = stream;

    videoEl.onloadedmetadata = () => {
        videoEl.play();
    }

    videoContainer.appendChild(videoEl);

     //check if user connected with only audio
    if (store.getState().connectOnlyWithAudio) {
       videoContainer.appendChild(getAudioOnlyLabel());
     }
    
    videosContainer.appendChild(videoContainer);
};

const addStream = (stream, connUserSocketId) => {
    //display incoming stream
    const videosContainer = document.getElementById("videos_portal");
    const videoContainer = document.createElement('div');
    console.log(videosContainer)
    videoContainer.id = connUserSocketId;

    videoContainer.classList.add('video_track_container');
    const videoEl = document.createElement('video');

    videoEl.autoplay = true;
    videoEl.srcObject = stream;
    videoEl.id = `${connUserSocketId}-video`;

    videoEl.onloadedmetadata = () => {
        videoEl.play();
    }

    videoEl.addEventListener('click', () => {
        if(videoEl.classList.contains("full_screen")){
            videoEl.classList.remove("full_screen");
        } else {
            videoEl.classList.add("full_screen");
        }
    })
    videoContainer.appendChild(videoEl);

    // check if other user connected only with audio
    const participants = store.getState().participants;

    const participant = participants.find((p) => p.socketId === connUserSocketId);
    if (participant?.onlyAudio) {
        videoContainer.appendChild(getAudioOnlyLabel(participant.identity));
    } else {
        videoContainer.style.position = "static";
    }

  videosContainer.appendChild(videoContainer);

}

const getAudioOnlyLabel = (identity = "") => {
    const labelContainer = document.createElement("div");
    labelContainer.classList.add("label_only_audio_container");
  
    const label = document.createElement("p");
    label.classList.add("label_only_audio_text");
    label.innerHTML = `Only audio ${identity}`;
  
    labelContainer.appendChild(label);
    return labelContainer;
  };



/******************Buttons logic*****************/

export const toggleMic = (isMuted) => {
    localStream.getAudioTracks()[0].enabled = isMuted;
}

export const toggleCamera = (isDisabled) => {
    localStream.getVideoTracks()[0].enabled = isDisabled;
}

export const toggleScreenShare = (isScreenSharingActive, screenSharingStream = null) => {
    if (isScreenSharingActive) {
        switchVideoTracks(localStream);
      } else {
        switchVideoTracks(screenSharingStream);
      }
}

const switchVideoTracks = (stream) => {
    for (let socket_id in peers) {
      for (let index in peers[socket_id].streams[0].getTracks()) {
        for (let index2 in stream.getTracks()) {
          if (
            peers[socket_id].streams[0].getTracks()[index].kind ===
            stream.getTracks()[index2].kind
          ) {
            peers[socket_id].replaceTrack(
              peers[socket_id].streams[0].getTracks()[index],
              stream.getTracks()[index2],
              peers[socket_id].streams[0]
            );
            break;
          }
        }
      }
    }
  };

  /******************Messages logic*****************/
  
  const appendNewMessage = (messageData) => {
    const messages = store.getState().messages;
    store.dispatch(setMessages([...messages, messageData]));
  }

  export const sendMessageUsingDataChannel = (messageContent) => {
    //append the message locally
    const identity = store.getState().identity;

    const localMessageData = {
        content: messageContent,
        identity,
        messageCreatedByMe: true,
    }

    appendNewMessage(localMessageData);

    const messageData = {
        content: messageContent,
        identity,
    }

    const stringifiedMessageData = JSON.stringify(messageData);
    for(let socketId in peers){
        peers[socketId].send(stringifiedMessageData);
    }
  }