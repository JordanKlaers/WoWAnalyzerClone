import React from 'react';
import PropTypes from 'prop-types';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import { t } from '@lingui/macro';

import getConfig from 'parser/getConfig';
import { getFightFromReport } from 'interface/selectors/fight';
import { getFightId, getPlayerId, getPlayerName } from 'interface/selectors/url/report';
import { fetchCombatants, fetchFights, LogNotFoundError } from 'common/fetchWclApi';
import { captureException } from 'common/errorLogger';
import { setReports } from 'interface/actions/report';
import { getReportCode } from 'interface/selectors/url/report';
import makeAnalyzerUrl from 'interface/makeAnalyzerUrl';
import ActivityIndicator from 'interface/ActivityIndicator';
import DocumentTitle from 'interface/DocumentTitle';

import handleApiError from './handleApiError';

// During peak traffic we might want to disable automatic refreshes to avoid hitting the rate limit.
// During regular traffic we should enable this as the fight caching is confusing users.
// Actually leaving this disabled for now so we can continue to serve reports when WCL goes down and high traffic to a specific report page doesn't bring us down (since everything would be logged). To solve the issue of confusion, I'll try improving the fight selection text instead.
const REFRESH_BY_DEFAULT = false;

class ReportLoader extends React.PureComponent {
  static propTypes = {
    children: PropTypes.func.isRequired,
    reportCode: PropTypes.string,
    setReports: PropTypes.func.isRequired,
    history: PropTypes.shape({
      push: PropTypes.func.isRequired, // adds to browser history
    }).isRequired,
  };
  state = {
    error: null,
    reports: null,
  };

  constructor(props) {
    super(props);
    this.handleRefresh = this.handleRefresh.bind(this);
  }
  setState(error = null, reports = null) {
    super.setState({
      error,
      reports,
    });
    // We need to set the report in the global state so the NavigationBar, which is not a child of this component, can also use it
    this.props.setReports(reports);
  }
  resetState() {
    this.setState(null, null);
  }

  componentDidMount() {
    if (this.props.reportCodes.length) {
      // noinspection JSIgnoredPromiseFromCall
      this.loadReport(this.props.reportCodes, this.props.reportURLs, REFRESH_BY_DEFAULT);
    }
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.props.reportCodes && this.props.reportCodes.length !== prevProps.reportCodes.length) {
      // noinspection JSIgnoredPromiseFromCall
      this.loadReport(this.props.reportCodes, this.props.reportURLs);
    }
  }
  async loadReport(reportCodes, reportURLs, refresh = false) {
    try {
      this.resetState();
      const reports = [];
      for (let i = 0; i < reportCodes.length; i++) {
        const reportCode = reportCodes[i];
        // const isAnonymous = reportCode.startsWith('a:');
        const report = await fetchFights(reportCode, refresh);
        //include the code, url, player and playerID associated with each report
        report['fightId'] = getFightId(reportURLs[i]);
        report['fight'] = getFightFromReport(report, report.fightId);
        report['playerId'] = getPlayerId(reportURLs[i]);
        report['player'] = report.friendlies.filter(friendly => {
          return friendly.id == report.playerId;
        })[0];
        report['playerName'] = report.player.name;
        report['code'] = reportCode;
        report['reportURL'] = reportURLs[i];
        const combatants = await fetchCombatants(report.code, report.fight.start_time, report.fight.end_time);
        const combatant = combatants.filter(combatant => {
          return combatant.sourceID == report.playerId;
        })[0]
        report['combatants'] = combatants;
        report['combatant'] = combatant;
        report['config'] = getConfig(combatant.specID);
        reports.push(report);
      }
      this.setState(null, reports);
      // We need to set the report in the global state so the NavigationBar, which is not a child of this component, can also use it
    } catch (err) {
      const isCommonError = err instanceof LogNotFoundError;
      if (!isCommonError) {
        captureException(err);
      }
      this.setState(err, null);
    }
  }
  handleRefresh() {
    // noinspection JSIgnoredPromiseFromCall
    this.loadReport(this.props.reportCodes, this.props.reportURLs, true);
  }

  renderError(error) {
    return handleApiError(error, () => {
      this.resetState();
      this.props.history.push(makeAnalyzerUrl());
    });
  }
  renderLoading() {
    return (
      <ActivityIndicator text={t({
        id: "interface.report.reportLoader",
        message: `Pulling report info...`
      })} />
    );
  }
  render() {
    const error = this.state.error;
    if (error) {
      return this.renderError(error);
    }

    const reports = this.state.reports;
    if (!reports) {
      return this.renderLoading();
    }

    return (
      <>
        {/* TODO: Refactor the DocumentTitle away */}
        <DocumentTitle title={'Multiple Reports'} />

        {this.props.children(reports, this.handleRefresh)}
      </>
    );
  }
}

const mapStateToProps = (state, props) => ({
  reportURLs: props.reportURLs,
  reportCodes: [...props.reportURLs].map(url => getReportCode(url))
});

export default compose(
  withRouter,
  connect(mapStateToProps, {
    setReports,
  }),
)(ReportLoader);
