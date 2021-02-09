import { SET_REPORT, SET_REPORTS } from 'interface/actions/report';

export default function report(state = null, action) {
  switch (action.type) {
    case SET_REPORT:
      return action.payload;
    case SET_REPORTS:
      return action.payload;
    default:
      return state;
  }
}
