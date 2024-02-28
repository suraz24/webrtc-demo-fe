import io from 'socket.io-client';
import store from '../store/store';
import { setParticipants, setRoomId } from '../store/actions';
import * as webRTCHandler from './webRTCHandler';

const SERVER = "https://web-rtc-demo-0355188c88b6.herokuapp.com/"
let socket = null;

export const connectWithSocketIOServer = () => {
    socket = io(SERVER);

    socket.on('connect', () => {
        console.log('socket connected'); 
        console.log(socket.id);
    })

    socket.on('room-id', (roomId) => {
        store.dispatch(setRoomId(roomId));
    })

    socket.on('room-update', (data) => {
        const { connectedUsers } = data;
        store.dispatch(setParticipants(connectedUsers));
    });

    socket.on('conn-prepare', (data) => {
        const { connectedUsersSocketId } = data;

        webRTCHandler.prepareNewPeerConnection(connectedUsersSocketId, false);

        //inform the user which just join the room that we have prepared for incoming connection
        socket.emit('conn-init', { connUserSocketId: connectedUsersSocketId })

    });

    socket.on('conn-signal', data => {
        webRTCHandler.handleSignalingData(data);
    })

    socket.on('conn-init', (data) => {
        const { connUserSocketId } = data;
        webRTCHandler.prepareNewPeerConnection(connUserSocketId, true);
    });

    socket.on('user-disconnected', (data) => {
        const { socketId } = data;
        webRTCHandler.removePeerConnection(socketId);
    });
}

export const createRoom = (identity, onlyAudio) => {
    const data =  {
        identity,
        onlyAudio
    };

    socket.emit('create-new-room', data)
};

export const joinRoom = (roomId, identity, onlyAudio) => {
    const data =  {
        roomId,
        identity,
        onlyAudio
    };

    socket.emit('join-room', data)
};

export const signalPeerData = (data) => {
    socket.emit('conn-signal', data);
} 
