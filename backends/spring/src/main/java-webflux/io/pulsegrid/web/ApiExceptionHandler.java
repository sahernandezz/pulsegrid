package io.pulsegrid.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.support.WebExchangeBindException;
import org.springframework.web.server.ServerWebInputException;

/**
 * 400 for invalid payloads on the reactive path (equivalent to the VT variant's).
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(WebExchangeBindException.class)
    public ProblemDetail onInvalid(WebExchangeBindException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Invalid payload: " + ex.getErrorCount() + " validation error(s)");
    }

    @ExceptionHandler(ServerWebInputException.class)
    public ProblemDetail onBadInput(ServerWebInputException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Invalid JSON or unknown metricType");
    }
}
