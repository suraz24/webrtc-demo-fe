import React, { useState } from "react";
import SwitchImg from "../../assets/images/switchToScreenSharing.svg";
import LocalScreenSharingPreview from './LocalSharingPreview'; 
import * as webRTCHandler from '../../utils/webRTCHandler';

const SwitchToScreenSharingButton = () => {
  const [isScreenSharingActive, setIsScreenSharingActive] = useState(false);
  const [screenSharingStream, setScreenSharingStream] = useState(null);

  const constraints = {
    audio: false,
    video: true
  }

  const handleScreenShareToggle = async() => {
    if(!isScreenSharingActive) {
      let stream = null;
      try{
        stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      }catch(err) {
        console.log('Error occured when sharing screen');
      }

      if (stream) {
        setScreenSharingStream(stream);
        webRTCHandler.toggleScreenShare(isScreenSharingActive, stream);
        setIsScreenSharingActive(true);
      }
    } else {
      webRTCHandler.toggleScreenShare(isScreenSharingActive);
      setIsScreenSharingActive(false);

      //stop screen share stream
      screenSharingStream.getTracks().forEach((t) => t.stop());
      setScreenSharingStream(null);
    }
  };

  return (
    <>
    <div className="video_button_container">
      <img
        src={SwitchImg}
        onClick={handleScreenShareToggle}
        className="video_button_image"
      />
    </div>
    {
      isScreenSharingActive && (
        <LocalScreenSharingPreview stream = {screenSharingStream} />
      )
    }
    </>
  );
};

export default SwitchToScreenSharingButton;
