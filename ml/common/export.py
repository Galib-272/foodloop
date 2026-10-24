"""
Export trained scikit-learn models to plain JSON so the Next.js app can run them without Python.
Supported: LinearRegression/Ridge, LogisticRegression (binary + multinomial), DecisionTree, RandomForest,
GradientBoosting (regressor + binary/multiclass classifier), KNeighbors (regressor/classifier),
optionally preceded by a StandardScaler (sklearn Pipeline with steps 'scaler' and 'model').
"""
from __future__ import annotations

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor, RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.pipeline import Pipeline
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor


def _r(a, d=6):
    return np.round(np.asarray(a, dtype=float), d).tolist()


def _tree(t, proba: bool):
    tr = t.tree_
    v = tr.value[:, :, :]  # (nodes, outputs, classes)
    if proba:
        vals = v[:, 0, :]
        vals = vals / np.clip(vals.sum(axis=1, keepdims=True), 1e-12, None)
        leaf = _r(vals, 6)
    else:
        leaf = _r(v[:, 0, 0], 6)
    return {"f": tr.feature.tolist(), "t": tr.threshold.astype(float).tolist(), "l": tr.children_left.tolist(), "r": tr.children_right.tolist(), "v": leaf}


def export_model(est, X_ref: np.ndarray) -> dict:
    """X_ref: a few rows of model input (after feature building) used to derive GB init scores."""
    scaler = None
    if isinstance(est, Pipeline):
        scaler = est.named_steps.get("scaler")
        model = est.named_steps["model"]
    else:
        model = est
    out: dict = {}
    if scaler is not None:
        out["scaler"] = {"mean": _r(scaler.mean_), "scale": _r(scaler.scale_)}
    if isinstance(model, (LinearRegression, Ridge)):
        out.update(type="linear", coef=_r(model.coef_), intercept=float(model.intercept_))
    elif isinstance(model, LogisticRegression):
        out.update(type="logistic", classes=[str(c) for c in model.classes_], coef=_r(model.coef_), intercept=_r(model.intercept_))
    elif isinstance(model, DecisionTreeRegressor):
        out.update(type="forest_reg", trees=[_tree(model, False)])
    elif isinstance(model, DecisionTreeClassifier):
        out.update(type="forest_clf", classes=[str(c) for c in model.classes_], trees=[_tree(model, True)])
    elif isinstance(model, RandomForestRegressor):
        out.update(type="forest_reg", trees=[_tree(e, False) for e in model.estimators_])
    elif isinstance(model, RandomForestClassifier):
        out.update(type="forest_clf", classes=[str(c) for c in model.classes_], trees=[_tree(e, True) for e in model.estimators_])
    elif isinstance(model, GradientBoostingRegressor):
        x0 = X_ref[:1] if scaler is None else scaler.transform(X_ref[:1])
        tree_sum = sum(e[0].predict(x0)[0] for e in model.estimators_)
        init = float(model.predict(x0)[0] - model.learning_rate * tree_sum)
        out.update(type="gbm_reg", init=init, lr=model.learning_rate, trees=[_tree(e[0], False) for e in model.estimators_])
    elif isinstance(model, GradientBoostingClassifier):
        x0 = X_ref[:1] if scaler is None else scaler.transform(X_ref[:1])
        raw = np.atleast_1d(model.decision_function(x0)[0])
        k = model.estimators_.shape[1]
        sums = np.array([sum(model.estimators_[s, j].predict(x0)[0] for s in range(model.estimators_.shape[0])) for j in range(k)])
        init = raw - model.learning_rate * sums
        out.update(type="gbm_clf", classes=[str(c) for c in model.classes_], init=_r(init), lr=model.learning_rate,
                   trees=[[_tree(model.estimators_[s, j], False) for j in range(k)] for s in range(model.estimators_.shape[0])])
    elif isinstance(model, (KNeighborsClassifier, KNeighborsRegressor)):
        if model.metric not in ("minkowski", "euclidean") or (model.metric == "minkowski" and model.p != 2):
            raise ValueError("Only Euclidean KNN is supported for export")
        fit_X = model._fit_X
        if isinstance(model, KNeighborsClassifier):
            out.update(type="knn_clf", classes=[str(c) for c in model.classes_], y=[int(i) for i in model._y])
        else:
            out.update(type="knn_reg", y=_r(model._y, 4))
        out.update(k=int(model.n_neighbors), weights=model.weights, X=_r(fit_X, 5))
    else:
        raise TypeError(f"Unsupported model type: {type(model).__name__}")
    return out
