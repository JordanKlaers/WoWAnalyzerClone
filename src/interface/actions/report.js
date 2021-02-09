export const SET_REPORT = 'SET_REPORT';
export function setReport(report) {
  return {
    type: SET_REPORT,
    payload: report,
  };
}
export const SET_REPORTS = 'SET_REPORTS';
export function setReports(reports) {
  return {
    type: SET_REPORTS,
    payload: reports,
  };
}
