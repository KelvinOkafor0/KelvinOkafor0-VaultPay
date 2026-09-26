export type RiskDecision={decision:'ALLOW'|'CHALLENGE'|'HOLD';reason:string};
export function assessTransfer(input:{amount:number;beneficiaryAgeMinutes:number;newDevice:boolean;recentAttempts:number}):RiskDecision{
 if(input.amount>=500000||input.recentAttempts>=5)return {decision:'HOLD',reason:'HIGH_VALUE_OR_VELOCITY'};
 if(input.newDevice||input.beneficiaryAgeMinutes<10)return {decision:'CHALLENGE',reason:'NEW_DEVICE_OR_BENEFICIARY'};
 return {decision:'ALLOW',reason:'NORMAL_PATTERN'};
}
