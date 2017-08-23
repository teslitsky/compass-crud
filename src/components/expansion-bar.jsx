const React = require('react');
const PropTypes = require('prop-types');

/**
 * The expander class.
 */
const EXPANDER = 'btn btn-default btn-xs';

/**
 * The arrow down class.
 */
const ARROW_DOWN = 'fa fa-arrow-down';

/**
 * The arrow up class.
 */
const ARROW_UP = 'fa fa-arrow-up';

class ExpansionBar extends React.PureComponent {

  /**
   * Handle clicking the "Hide N fields" button.
   */
  handleHideClick() {
    this.props.setRenderSize(this.props.initialSize);
  }

  /**
   * Handle clicking the "Show N more fields" button.
   */
  handleShowClick() {
    const newSize = Math.min(this.props.renderSize + this.props.perClickSize, this.props.everythingSize);
    this.props.setRenderSize(newSize);
  }

  renderShowMoreFieldsButton(showMoreFields) {
    const showText = `Show ${showMoreFields} more fields`;
    return (
      <button className={EXPANDER} onClick={this.handleShowClick.bind(this)}>
        <i className={ARROW_DOWN} aria-hidden="true" />
        <span>{showText}</span>
      </button>
    );
  }

  renderHideFieldsButton(hideFields) {
    const hideText = `Hide ${hideFields} fields`;
    return (
      <button className={EXPANDER} onClick={this.handleHideClick.bind(this)}>
        <i className={ARROW_UP} aria-hidden="true" />
        <span>{hideText}</span>
      </button>
    );
  }

  /**
   * Render the show/hide fields bar.
   *
   * Clicking "Show N more fields" adds up to MAX_EXTRA_FIELDS at a time,
   * clicking "Hide M fields" hides drops back to this.props.initialSize.
   *
   * @returns {React.Component} The expander bar.
   */
  render() {
    const components = [];
    const total = this.props.everythingSize;
    if (total > this.props.initialSize && !this.props.editing && !this.props.deleting) {
      const showMoreFields = Math.min(total - this.props.renderSize, this.props.perClickSize);
      const hideFields = this.props.renderSize - this.props.initialSize;
      if (this.props.renderSize < total) {
        components.push(this.renderShowMoreFieldsButton(showMoreFields));
      }
      if (this.props.renderSize > this.props.initialSize) {
        components.push(this.renderHideFieldsButton(hideFields));
      }
    }
    return <div>{components}</div>;
  }
}

ExpansionBar.propTypes = {
  // TODO: Can we generalise the deleting/editing to make this component easier to understand?
  deleting: PropTypes.bool.isRequired,
  editing: PropTypes.bool.isRequired,
  everythingSize: PropTypes.number.isRequired,  // Maximum number of elements to render
  initialSize: PropTypes.number.isRequired,     // Initial number of elements to render
  perClickSize: PropTypes.number.isRequired,    // Extra elements to render per click
  renderSize: PropTypes.number.isRequired,      // Current number of elements to be rendered
  setRenderSize: PropTypes.func.isRequired      // Callback to allow the new renderSize to be set outside the component
};

module.exports = ExpansionBar;
