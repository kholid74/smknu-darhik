export function confirmAction(message:string):Promise<boolean>{
  const dialog=document.querySelector<HTMLDialogElement>('#action-confirm-dialog');
  if(!dialog)return Promise.resolve(window.confirm(message));
  if(dialog.open)return Promise.resolve(false);
  dialog.querySelector<HTMLElement>('#action-confirm-dialog-description')!.textContent=message;
  dialog.returnValue='cancel';
  return new Promise(resolve=>{dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'),{once:true});dialog.showModal()});
}
