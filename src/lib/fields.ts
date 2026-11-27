export function fieldHref(path: string): string {
  if (path === "commitmentsMonthly") return "#commitments";
  const jobPay = /^jobs\.(\d+)\.netPay$/.exec(path);
  if (jobPay) return `#job-${jobPay[1]}-net-pay`;
  const jobCadence = /^jobs\.(\d+)\.cadence$/.exec(path);
  if (jobCadence) return `#job-${jobCadence[1]}-frequency`;
  const optionName = /^options\.(\d+)\.name$/.exec(path);
  if (optionName) return `#option-${optionName[1]}-name`;
  const optionPayment = /^options\.(\d+)\.monthlyPayment$/.exec(path);
  if (optionPayment) return `#option-${optionPayment[1]}-payment`;
  const optionUpfront = /^options\.(\d+)\.upfrontCash$/.exec(path);
  if (optionUpfront) return `#option-${optionUpfront[1]}-upfront`;
  return "#tool-form";
}
