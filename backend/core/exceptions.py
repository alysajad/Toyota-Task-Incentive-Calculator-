"""
Unified DRF exception handling.

Every error response is normalised to the shape promised in the API spec:

    { "detail": "<human message>", "errors": { ...field errors... } }
"""
from rest_framework.views import exception_handler as drf_exception_handler


def api_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    detail = "Request failed."
    errors = {}

    if isinstance(data, dict):
        if "detail" in data and len(data) == 1:
            detail = str(data["detail"])
        else:
            errors = data
            # Surface a non-field error as the headline detail when present.
            non_field = data.get("non_field_errors")
            if non_field:
                detail = non_field[0] if isinstance(non_field, list) else str(non_field)
            else:
                detail = "Validation failed."
    elif isinstance(data, list):
        errors = {"non_field_errors": data}
        detail = data[0] if data else detail

    response.data = {"detail": str(detail), "errors": errors}
    return response
