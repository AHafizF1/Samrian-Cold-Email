import os

import schemathesis


@schemathesis.hook
def before_call(context, case, kwargs):
    token = os.environ.get("SAMRIAN_TOKEN")
    run_id = os.environ.get("SECURITY_RUN_ID")
    if token:
        kwargs.setdefault("headers", {})["Authorization"] = f"Bearer {token}"
    if run_id:
        headers = kwargs.setdefault("headers", {})
        headers["x-request-id"] = run_id
        headers["x-correlation-id"] = run_id
