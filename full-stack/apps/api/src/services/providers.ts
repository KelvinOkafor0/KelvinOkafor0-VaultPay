import crypto from 'node:crypto';
import { env } from '../env.js';

export type NameEnquiryResult={bankCode:string;accountNumber:string;accountName:string;providerReference:string};
export type BankInfo={code:string;name:string;providerType?:string};
export type TransferProviderResult={status:'PROCESSING'|'FAILED';providerReference:string;failureCode?:string;failureMessage?:string};
export type TransferProviderStatus='PROCESSING'|'SUCCESS'|'FAILED'|'REVERSED';
export type TransferProviderDetails={status:TransferProviderStatus;providerReference:string;amount?:string;currency?:string;reference?:string;fee?:string;accountNumber?:string;accountName?:string};
export type FundingTransactionDetails={status:'PROCESSING'|'SUCCESS'|'FAILED'|'REVERSED';providerReference:string;amount?:string;currency?:string;reference?:string;accountNumber?:string;accountName?:string};
export type FundingAccountResult={accountNumber:string;bankName:string;providerReference:string;isPermanent:boolean;expiryDate?:string};

export interface BankProvider {
  listBanks?():Promise<BankInfo[]>;
  nameEnquiry(bankCode:string,accountNumber:string):Promise<NameEnquiryResult>;
  submitTransfer(input:{bankCode:string;accountNumber:string;amount:string;reference:string;description?:string}):Promise<TransferProviderResult>;
  getTransferStatus(providerReference:string):Promise<TransferProviderStatus>;
  getTransferDetails(providerReference:string):Promise<TransferProviderDetails>;
  getTransactionDetails?(transactionId:string):Promise<FundingTransactionDetails>;
  createFundingAccount?(input:{email:string;phone:string;firstName:string;lastName:string;currency:'NGN';isPermanent:boolean;bvn?:string;nin?:string;reference:string}):Promise<FundingAccountResult>;
}
export interface KycProvider {
  start(input:{firstName:string;lastName:string;dateOfBirth:string;phone:string;bvn?:string;redirectUrl?:string}):Promise<{providerReference:string;status:'PENDING'|'VERIFIED';consentUrl?:string}>;
}
export interface CardProvider {
  issue(input:{userId:string;accountId:string;type:'VIRTUAL'|'PHYSICAL'}):Promise<{providerReference:string;network:string;last4:string;expiryMonth:number;expiryYear:number;tokenReference:string}>;
  setStatus(ref:string,status:'ACTIVE'|'FROZEN'):Promise<void>;
}

async function flwFetch<T>(path:string,init:RequestInit={}):Promise<T>{
  if(!env.FLW_SECRET_KEY) throw Object.assign(new Error('FLUTTERWAVE_NOT_CONFIGURED'),{statusCode:503});
  const res=await fetch(`${env.FLW_BASE_URL}${path}`,{
    ...init,
    headers:{'Authorization':`Bearer ${env.FLW_SECRET_KEY}`,'Content-Type':'application/json','Accept':'application/json',...(init.headers??{})}
  });
  const text=await res.text();
  let body:any={}; try{ body=text?JSON.parse(text):{} }catch{ body={raw:text}; }
  if(!res.ok || body?.status==='error'){
    const message=body?.message||`Flutterwave request failed (${res.status})`;
    throw Object.assign(new Error(message),{statusCode:502,providerStatus:res.status,providerBody:body});
  }
  return body as T;
}

export class FlutterwaveBankProvider implements BankProvider{
  async listBanks(){const body=await flwFetch<any>('/v3/banks/NG?include_provider_type=1',{method:'GET'});return (body.data??[]).map((b:any)=>({code:String(b.code??b.id),name:String(b.name??b.bank_name??''),providerType:b.provider_type?String(b.provider_type):undefined}));}
  async nameEnquiry(bankCode:string,accountNumber:string){
    const body=await flwFetch<any>('/v3/accounts/resolve',{method:'POST',body:JSON.stringify({account_number:accountNumber,account_bank:bankCode})});
    return {bankCode,accountNumber,accountName:String(body.data?.account_name??''),providerReference:String(body.data?.account_number??accountNumber)};
  }
  async submitTransfer(input:{bankCode:string;accountNumber:string;amount:string;reference:string;description?:string}){
    const body=await flwFetch<any>('/v3/transfers',{method:'POST',body:JSON.stringify({account_bank:input.bankCode,account_number:input.accountNumber,amount:Number(input.amount),currency:'NGN',narration:input.description??'VaultPay transfer',reference:input.reference})});
    const status=String(body.data?.status??'NEW').toUpperCase();
    if(['FAILED','ERROR'].includes(status)) return {status:'FAILED' as const,providerReference:String(body.data?.id??body.data?.reference??input.reference),failureCode:'PROVIDER_FAILED',failureMessage:String(body.message??'Transfer failed')};
    return {status:'PROCESSING' as const,providerReference:String(body.data?.id??body.data?.reference??input.reference)};
  }
  async getTransferDetails(providerReference:string){
    const body=await flwFetch<any>(`/v3/transfers/${encodeURIComponent(providerReference)}`,{method:'GET'});
    const d=body.data??{}; const status=String(d.status??'NEW').toUpperCase();
    const normalized:TransferProviderStatus=status==='SUCCESSFUL'||status==='SUCCESS'?'SUCCESS':status==='FAILED'?'FAILED':status==='REVERSED'?'REVERSED':'PROCESSING';
    return {status:normalized,providerReference:String(d.id??providerReference),amount:d.amount!=null?String(d.amount):undefined,currency:d.currency?String(d.currency):undefined,reference:d.reference?String(d.reference):undefined,fee:d.fee!=null?String(d.fee):undefined,accountNumber:d.account_number?String(d.account_number):undefined,accountName:d.fullname?String(d.fullname):undefined};
  }
  async getTransferStatus(providerReference:string){ return (await this.getTransferDetails(providerReference)).status; }
  async getTransactionDetails(transactionId:string){
    const body=await flwFetch<any>(`/v3/transactions/${encodeURIComponent(transactionId)}/verify`,{method:'GET'});
    const d=body.data??{}; const status=String(d.status??'').toLowerCase();
    const normalized:FundingTransactionDetails['status']=status==='successful'?'SUCCESS':status==='failed'?'FAILED':status==='reversed'?'REVERSED':'PROCESSING';
    const accountNumber=d.account_number??d.account?.account_number??d.meta?.account_number;
    const accountName=d.fullname??d.full_name??d.customer?.name;
    return {status:normalized,providerReference:String(d.id??transactionId),amount:(d.amount_settled??d.charged_amount??d.amount)!=null?String(d.amount_settled??d.charged_amount??d.amount):undefined,currency:d.currency?String(d.currency):undefined,reference:d.tx_ref?String(d.tx_ref):undefined,accountNumber:accountNumber?String(accountNumber):undefined,accountName:accountName?String(accountName):undefined};
  }
  async createFundingAccount(input:{email:string;phone:string;firstName:string;lastName:string;currency:'NGN';isPermanent:boolean;bvn?:string;nin?:string;reference:string}){
    const body=await flwFetch<any>('/v3/virtual-account-numbers',{method:'POST',body:JSON.stringify({email:input.email,phonenumber:input.phone,firstname:input.firstName,lastname:input.lastName,currency:'NGN',is_permanent:input.isPermanent,tx_ref:input.reference,...(input.bvn?{bvn:input.bvn}:{}),...(input.nin?{nin:input.nin}:{})})});
    const data=body.data??{};
    const accountNumber=String(data.account_number??data.accountNumber??'');
    const bankName=String(data.bank_name??data.bankName??'');
    if(!accountNumber) throw Object.assign(new Error('FUNDING_ACCOUNT_NOT_RETURNED'),{statusCode:502});
    return {accountNumber,bankName,providerReference:String(data.flw_ref??data.reference??input.reference),isPermanent:input.isPermanent,expiryDate:data.expiry_date?String(data.expiry_date):undefined};
  }
}

export class FlutterwaveKycProvider implements KycProvider{
  async start(input:{firstName:string;lastName:string;dateOfBirth:string;phone:string;bvn?:string;redirectUrl?:string}){
    if(!input.bvn) throw Object.assign(new Error('BVN_REQUIRED'),{statusCode:400});
    const body=await flwFetch<any>('/v3/bvn/verifications',{method:'POST',body:JSON.stringify({bvn:input.bvn,firstname:input.firstName,lastname:input.lastName,redirect_url:input.redirectUrl??env.FLW_KYC_REDIRECT_URL})});
    return {providerReference:String(body.data?.reference),status:'PENDING' as const,consentUrl:body.data?.url?String(body.data.url):undefined};
  }
}

export class MockBankProvider implements BankProvider{
 async listBanks(){return [{code:'044',name:'Access Bank'},{code:'058',name:'GTBank'},{code:'057',name:'Zenith Bank'},{code:'100004',name:'OPay'}]}
 async nameEnquiry(bankCode:string,accountNumber:string){return {bankCode,accountNumber,accountName:'DEMO BENEFICIARY',providerReference:`NEQ-${accountNumber.slice(-6)}`}}
 async submitTransfer(input:{bankCode:string;accountNumber:string;amount:string;reference:string;description?:string}):Promise<TransferProviderResult>{void input;return {status:'PROCESSING',providerReference:`TRF-${crypto.randomUUID()}`}}
 async getTransferStatus(){return 'SUCCESS' as const}
 async getTransferDetails(providerReference:string){return {status:'SUCCESS' as const,providerReference,amount:'0',currency:'NGN',reference:providerReference}}
 async createFundingAccount(input:{email:string;phone:string;firstName:string;lastName:string;currency:'NGN';isPermanent:boolean;bvn?:string;nin?:string;reference:string}){void input;return {accountNumber:`101${Math.floor(10000000+Math.random()*89999999)}`,bankName:'Demo MFB',providerReference:`VA-${crypto.randomUUID()}`,isPermanent:input.isPermanent}}
}
export class MockKycProvider implements KycProvider{async start(input:{firstName:string;lastName:string;dateOfBirth:string;phone:string;bvn?:string;redirectUrl?:string}){void input;return {providerReference:`KYC-${crypto.randomUUID()}`,status:'VERIFIED' as const}}}
export class MockCardProvider implements CardProvider{async issue(input:{userId:string;accountId:string;type:'VIRTUAL'|'PHYSICAL'}){void input;const last4=String(1000+crypto.randomInt(0,9000));return {providerReference:`CARD-${crypto.randomUUID()}`,network:'VISA',last4,expiryMonth:12,expiryYear:new Date().getFullYear()+4,tokenReference:`tok_${crypto.randomUUID()}`}} async setStatus(ref:string,status:'ACTIVE'|'FROZEN'){void ref;void status}}

export function getBankProvider():BankProvider{
  return env.BANK_PROVIDER==='flutterwave'?new FlutterwaveBankProvider():new MockBankProvider();
}
export function getKycProvider():KycProvider{
  return env.KYC_PROVIDER==='flutterwave'?new FlutterwaveKycProvider():new MockKycProvider();
}
export function getCardProvider():CardProvider{
  return new MockCardProvider();
}
