const React = require('react');
const PropTypes = require('prop-types');
const Reflux = require('reflux');
const HadronDocument = require('hadron-document');
const Element = require('hadron-document').Element;
const Actions = require('../actions');
const ExpansionBar = require('./expansion-bar');
const EditableElement = require('./editable-element');
const DocumentActions = require('./document-actions');
const DocumentFooter = require('./document-footer');
const RemoveDocumentFooter = require('./remove-document-footer');

/**
 * The base class.
 */
const BASE = 'document';

/**
 * The elements class.
 */
const ELEMENTS = `${BASE}-elements`;

/**
 * The initial field limit.
 */
const INITIAL_FIELD_LIMIT = 25;

/**
 * The test id.
 */
const TEST_ID = 'editable-document';

/**
 * The delete error message.
 */
const DELETE_ERROR = new Error('Cannot delete documents that do not have an _id field.');

/**
 * Component for a single editable document in a list of documents.
 */
class EditableDocument extends React.Component {

  /**
   * The component constructor.
   *
   * @param {Object} props - The properties.
   */
  constructor(props) {
    super(props);
    this.doc = EditableDocument.loadDocument(props.doc);
    this.state = {
      renderSize: INITIAL_FIELD_LIMIT,
      editing: false,
      deleting: false,
      deleteFinished: false,
      expandAll: false
    };

    // Actions need to be scoped to the single document component and not
    // global singletons.
    this.actions = Reflux.createActions([ 'update', 'remove', 'cancelRemove' ]);

    // The update store needs to be scoped to a document and not a global
    // singleton.
    this.updateStore = this.createUpdateStore(this.actions);
    this.removeStore = this.createRemoveStore(this.actions);
  }

  /**
   * Subscribe to the update store on mount.
   */
  componentDidMount() {
    this.unsubscribeUpdate = this.updateStore.listen(this.handleStoreUpdate.bind(this));
    this.unsubscribeRemove = this.removeStore.listen(this.handleStoreRemove.bind(this));
    this.subscribeToDocumentEvents();
  }

  /**
   * Unsubscribe from the udpate store on unmount.
   */
  componentWillUnmount() {
    this.unsubscribeUpdate();
    this.unsubscribeRemove();
    this.unsubscribeFromDocumentEvents();
  }

  setRenderSize(newLimit) {
    require('marky').mark('EditableDocument - Show/Hide N fields');
    this.setState({
      renderSize: newLimit
    }, () => {
      require('marky').mark('EditableDocument - Show/Hide N fields');
    });
  }

  /**
   * Load the hadron document for the provided document.
   *
   * @param {Object} doc - The document to load.
   *
   * @returns {HadronDocument} The hadron document.
   */
  static loadDocument(doc) {
    return new HadronDocument(doc);
  }

  subscribeToDocumentEvents() {
    this.unsubscribeFromDocumentEvents();

    if (!this.unsubscribeAdded) {
      this.unsubscribeAdded = this.handleModify.bind(this);
      this.unsubscribeRemoved = this.handleModify.bind(this);
      this.unsubscribeCancel = this.handleCancel.bind(this);
    }

    this.doc.on(Element.Events.Added, this.unsubscribeAdded);
    this.doc.on(Element.Events.Removed, this.unsubscribeRemoved);
    this.doc.on(HadronDocument.Events.Cancel, this.unsubscribeCancel);
  }

  unsubscribeFromDocumentEvents() {
    if (this.unsubscribeAdded) {
      this.doc.removeListener(Element.Events.Added, this.unsubscribeAdded);
      this.doc.removeListener(Element.Events.Removed, this.unsubscribeRemoved);
      this.doc.removeListener(HadronDocument.Events.Cancel, this.unsubscribeCancel);
    }
  }

  /**
   * Create the scoped update store.
   *
   * @param {Action} actions - The component reflux actions.
   *
   * @returns {Store} The scoped store.
   */
  createUpdateStore(actions) {
    return Reflux.createStore({

      /**
       * Initialize the store.
       */
      init: function() {
        this.ns = global.hadronApp.appRegistry.getStore('App.NamespaceStore').ns;
        this.listenTo(actions.update, this.update);
      },

      /**
       * Update the document in the database.
       *
       * @param {Object} object - The replacement document.
       *
       * @todo: Durran: Determine shard key.
       */
      update: function(object) {
        // TODO (@thomasr) this does not work for projections
        global.hadronApp.dataService.findOneAndReplace(
          this.ns,
          { _id: object._id },
          object,
          { returnOriginal: false, promoteValues: false },
          this.handleResult
        );
      },

      /**
       * Handle the result from the driver.
       *
       * @param {Error} error - The error.
       * @param {Object} doc - The document.
       *
       * @returns {Object} The trigger event.
       */
      handleResult: function(error, doc) {
        return (error) ? this.trigger(false, error) : this.trigger(true, doc);
      }
    });
  }

  /**
   * Create the scoped remove store.
   *
   * @param {Action} actions - The component reflux actions.
   *
   * @returns {Store} The scoped store.
   */
  createRemoveStore(actions) {
    return Reflux.createStore({

      /**
       * Initialize the store.
       */
      init: function() {
        this.ns = global.hadronApp.appRegistry.getStore('App.NamespaceStore').ns;
        this.listenTo(actions.remove, this.remove);
      },

      /**
       * Remove the document from the collection.
       *
       * @param {Object} object - The object to delete.
       */
      remove: function(object) {
        const id = object.getId();
        if (id) {
          global.hadronApp.dataService.deleteOne(this.ns, { _id: id }, {}, this.handleResult);
        } else {
          this.handleResult(DELETE_ERROR);
        }
      },

      /**
       * Handle the result from the driver.
       *
       * @param {Error} error - The error.
       * @param {Object} result - The document.
       *
       * @returns {Object} The trigger event.
       */
      handleResult: function(error, result) {
        return (error) ? this.trigger(false, error) : this.trigger(true, result);
      }
    });
  }

  /**
   * Handles a trigger from the store.
   *
   * @param {Boolean} success - If the update succeeded.
   * @param {Object} object - The error or document.
   */
  handleStoreUpdate(success, object) {
    if (this.state.editing) {
      if (success) {
        this.handleUpdateSuccess(object);
      }
    }
  }

  /**
   * Handles a trigger from the store.
   *
   * @param {Boolean} success - If the update succeeded.
   */
  handleStoreRemove(success) {
    if (success) {
      this.handleRemoveSuccess();
    }
  }

  /**
   * Handle a successful update.
   *
   * @param {Object} doc - The updated document.
   */
  handleUpdateSuccess(doc) {
    require('marky').mark('EditableDocument - Handle update success');
    this.doc = EditableDocument.loadDocument(doc);
    this.subscribeToDocumentEvents();
    setTimeout(() => {
      this.setState({ editing: false }, () => {
        require('marky').stop('EditableDocument - Handle update success');
      });
    }, 500);
  }

  /**
   * Handle a successful update.
   */
  handleRemoveSuccess() {
    this.setState({ deleting: false, deleteFinished: true });
    Actions.documentRemoved(this.props.doc._id);
  }

  /**
   * Handles canceling edits to the document.
   */
  handleCancel() {
    require('marky').mark('EditableDocument - Cancel');
    this.setState({ editing: false }, () => {
      require('marky').stop('EditableDocument - Cancel');
    });
  }

  /**
   * Handle cloning of the document.
   */
  handleClone() {
    Actions.openInsertDocumentDialog(this.doc.generateObject(), true);
  }

  /**
   * Handles document deletion.
   */
  handleDelete() {
    this.setState({ editing: false, deleting: true });
  }

  /**
   * Handles canceling a delete.
   */
  handleCancelDelete() {
    this.setState({ deleting: false });
  }

  /**
   * Handle the edit click.
   */
  handleEdit() {
    require('marky').mark('EditableDocument - Edit');
    this.setState({ editing: true }, () => {
      require('marky').stop('EditableDocument - Edit');
    });
  }

  /**
   * Handles modification to the document.
   */
  handleModify() {
    this.forceUpdate();
  }

  /**
   * Handle clicking the expand all button.
   */
  handleExpandAll() {
    require('marky').mark('EditableDocument - Expand All');
    this.setState({ expandAll: !this.state.expandAll }, () => {
      require('marky').stop('EditableDocument - Expand All');
    });
  }

  /**
   * Get the current style of the document div.
   *
   * @returns {String} The document class name.
   */
  style() {
    let style = BASE;
    if (this.state.editing) {
      style = style.concat(' document-is-editing');
    }
    if (this.state.deleting && !this.state.deleteFinished) {
      style = style.concat(' document-is-deleting');
    }
    return style;
  }

  /**
   * Render the actions component.
   *
   * @returns {Component} The actions component.
   */
  renderActions() {
    if (!this.state.editing && !this.state.deleting) {
      return (
        <DocumentActions
          allExpanded={this.state.expandAll}
          edit={this.handleEdit.bind(this)}
          remove={this.handleDelete.bind(this)}
          clone={this.handleClone.bind(this)}
          expandAll={this.handleExpandAll.bind(this)} />
      );
    }
  }

  /**
   * Get the elements for the document. If we are editing, we get editable elements,
   * otherwise the readonly elements are returned.
   *
   * @returns {Array} The elements.
   */
  renderElements() {
    const components = [];
    let index = 0;
    for (const element of this.doc.elements) {
      components.push((
        <EditableElement
          key={element.uuid}
          element={element}
          indent={0}
          editing={this.state.editing}
          edit={this.handleEdit.bind(this)}
          expandAll={this.state.expandAll}
        />
      ));
      index++;
      if (index >= this.state.renderSize) {
        if (!this.state.editing && !this.state.deleting) {
          break;
        }
      }
    }
    const everythingSize = this.doc.elements.size;
    let initialSize = INITIAL_FIELD_LIMIT;
    if (this.state.deleting || this.state.editing) {
      initialSize = everythingSize;
    }
    components.push(<ExpansionBar
      everythingSize={everythingSize}
      initialSize={initialSize}
      renderSize={this.state.renderSize}
      setRenderSize={this.setRenderSize.bind(this)}
    />);
    return components;
  }

  /**
   * Render the footer component.
   *
   * @returns {Component} The footer component.
   */
  renderFooter() {
    if (this.state.editing) {
      return (
        <DocumentFooter
          doc={this.doc}
          updateStore={this.updateStore}
          actions={this.actions} />
      );
    } else if (this.state.deleting) {
      return (
        <RemoveDocumentFooter
          doc={this.doc}
          removeStore={this.removeStore}
          actions={this.actions}
          cancelHandler={this.handleCancelDelete.bind(this)} />
      );
    }
  }

  /**
   * Render a single document list item.
   *
   * @returns {React.Component} The component.
   */
  render() {
    return (
      <div className={this.style()} data-test-id={TEST_ID}>
        <ol className={ELEMENTS}>
          {this.renderElements()}
        </ol>
        {this.renderActions()}
        {this.renderFooter()}
      </div>
    );
  }
}

EditableDocument.displayName = 'EditableDocument';

EditableDocument.propTypes = {
  doc: PropTypes.object.isRequired,
  editable: PropTypes.bool,
  expandAll: PropTypes.bool
};

module.exports = EditableDocument;
