const ICE_SERVERS = [];

export async function connectHrInterview({sessionId,role,request}) {
  if(!['company','student'].includes(role))throw new Error('Invalid interview participant.');
  const modal=document.createElement('div');
  modal.className='pr-modal-backdrop hr-call-backdrop';
  modal.innerHTML='<section class="pr-assessment-modal hr-call-modal" role="dialog" aria-modal="true" aria-labelledby="hrCallTitle"><header><div><span class="pr-eyebrow">STEPUP ONE-ON-ONE</span><h2 id="hrCallTitle">Connecting to HR interview</h2><p data-call-status>Requesting camera and microphone access…</p></div></header><div class="hr-call-videos"><div class="hr-call-video"><video data-remote-video autoplay playsinline></video><span>Other participant</span></div><div class="hr-call-video hr-call-local"><video data-local-video autoplay playsinline muted></video><span>You</span></div></div><div class="hr-call-controls"><button type="button" data-toggle-mic>Mute microphone</button><button type="button" data-toggle-camera>Turn camera off</button><button type="button" class="hr-call-end" data-end-call>End interview</button></div><p class="hr-call-privacy">Direct peer-to-peer connection only (no external STUN/TURN relay). Some networks may block calls. StepUp does not record or store audio or video.</p></section>';
  document.body.append(modal);
  const status=modal.querySelector('[data-call-status]');
  const setStatus=text=>{status.textContent=text;};
  let stream=null,peer=null,polling=false,ended=false,sessionStarted=false,cursor=0;
  let pendingCandidates=[];
  const endButton=modal.querySelector('[data-end-call]');
  endButton.disabled=true;
  const cleanUp=()=>{
    polling=false;
    peer?.close();
    stream?.getTracks().forEach(track=>track.stop());
    modal.remove();
  };
  const close=async()=>{
    if(ended)return;
    ended=true;
    if(!sessionStarted){cleanUp();return;}
    setStatus('Ending the interview…');
    try{await request(`/hr-interviews/${encodeURIComponent(sessionId)}/end`,{method:'POST'});}
    catch(error){console.error('Could not end HR interview cleanly:',error);setStatus(`Call closed locally. Server update failed: ${error.message||'retry from the portal'}`);await new Promise(resolve=>setTimeout(resolve,1800));}
    cleanUp();
  };
  endButton.addEventListener('click',close);
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera and microphone require a supported browser on HTTPS or localhost.');
    stream=await navigator.mediaDevices.getUserMedia({audio:true,video:true});
    if(ended){stream.getTracks().forEach(track=>track.stop());return;}
    modal.querySelector('[data-local-video]').srcObject=stream;
    if(role==='company'){
      await request(`/company/hr-interviews/${encodeURIComponent(sessionId)}/start`,{method:'POST'});
      sessionStarted=true;
    }else{
      await request(`/student/hr-interviews/${encodeURIComponent(sessionId)}/join`,{method:'POST'});
      sessionStarted=true;
    }
    endButton.disabled=false;
    peer=new RTCPeerConnection({iceServers:ICE_SERVERS});
    stream.getTracks().forEach(track=>peer.addTrack(track,stream));
    peer.ontrack=event=>{modal.querySelector('[data-remote-video]').srcObject=event.streams[0];};
    peer.onicecandidate=event=>{
      if(event.candidate&&!ended)request(`/hr-interviews/${encodeURIComponent(sessionId)}/signals`,{method:'POST',body:JSON.stringify({type:'ice',payload:event.candidate.toJSON()})}).catch(error=>setStatus(`Network setup failed: ${error.message||'please retry'}`));
    };
    peer.onconnectionstatechange=()=>{
      if(peer.connectionState==='connected')setStatus('Connected · private one-on-one HR interview');
      else if(peer.connectionState==='connecting')setStatus('Connecting to the other participant…');
      else if(peer.connectionState==='failed')setStatus('Could not establish a direct connection. Check both networks and retry.');
    };
    const addRemoteCandidate=async candidate=>{
      if(!peer.remoteDescription){pendingCandidates.push(candidate);return;}
      try{await peer.addIceCandidate(candidate);}catch(error){console.warn('Could not add interview network candidate:',error);}
    };
    const flushCandidates=async()=>{
      const queued=pendingCandidates;pendingCandidates=[];
      for(const candidate of queued)await addRemoteCandidate(candidate);
    };
    if(role==='company'){
      const offer=await peer.createOffer();
      await peer.setLocalDescription(offer);
      await request(`/hr-interviews/${encodeURIComponent(sessionId)}/signals`,{method:'POST',body:JSON.stringify({type:'offer',payload:peer.localDescription.toJSON()})});
      setStatus('Interview started · waiting for the student to join…');
    }else setStatus('Joined interview · connecting securely…');
    polling=true;
    const poll=async()=>{
      while(polling&&!ended){
        try{
          const result=await request(`/hr-interviews/${encodeURIComponent(sessionId)}/signals?after=${cursor}`);
          if(result.status==='ended'){setStatus('The other participant ended the interview.');ended=true;cleanUp();return;}
          for(const signal of result.signals||[]){
            cursor=Math.max(cursor,Number(signal.id)||0);
            if(signal.sender_role===role)continue;
            if(signal.signal_type==='offer'&&role==='student'&&!peer.remoteDescription){
              await peer.setRemoteDescription(signal.payload);
              await flushCandidates();
              const answer=await peer.createAnswer();
              await peer.setLocalDescription(answer);
              await request(`/hr-interviews/${encodeURIComponent(sessionId)}/signals`,{method:'POST',body:JSON.stringify({type:'answer',payload:peer.localDescription.toJSON()})});
            }else if(signal.signal_type==='answer'&&role==='company'&&!peer.remoteDescription){
              await peer.setRemoteDescription(signal.payload);
              await flushCandidates();
            }else if(signal.signal_type==='ice'){
              await addRemoteCandidate(signal.payload);
            }
          }
        }catch(error){
          if(polling&&!ended)setStatus(`Connection update failed: ${error.message||'retrying…'}`);
        }
        if(polling&&!ended)await new Promise(resolve=>setTimeout(resolve,900));
      }
    };
    poll();
    const micButton=modal.querySelector('[data-toggle-mic]');
    micButton.addEventListener('click',()=>{
      const track=stream.getAudioTracks()[0];if(!track)return;
      track.enabled=!track.enabled;micButton.textContent=track.enabled?'Mute microphone':'Unmute microphone';
    });
    const cameraButton=modal.querySelector('[data-toggle-camera]');
    cameraButton.addEventListener('click',()=>{
      const track=stream.getVideoTracks()[0];if(!track)return;
      track.enabled=!track.enabled;cameraButton.textContent=track.enabled?'Turn camera off':'Turn camera on';
    });
  }catch(error){
    setStatus(error.message||'Could not start the HR interview.');
    if(sessionStarted){
      try{await request(`/hr-interviews/${encodeURIComponent(sessionId)}/end`,{method:'POST'});}
      catch(endError){console.error('Could not cancel failed HR interview call:',endError);}
      sessionStarted=false;
    }
    peer?.close();
    peer=null;
    stream?.getTracks().forEach(track=>track.stop());
    endButton.textContent='Close';
    endButton.disabled=false;
    setStatus(error.message||'Could not start the HR interview.');
  }
}
