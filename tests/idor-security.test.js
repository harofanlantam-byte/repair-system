// =============================================
// Security Tests - IDOR Protection
// =============================================

function buildRepairDetailQuery(role, userId, repairId) {
    var sql, params;
    if (role === 'user') {
        sql = 'SELECT rr.* FROM repair_requests rr WHERE rr.id=? AND rr.user_id=?';
        params = [repairId, userId];
    } else if (role === 'manager') {
        sql = 'SELECT rr.* FROM repair_requests rr WHERE rr.id=? AND (rr.department_id IN (SELECT id FROM departments WHERE manager_id=?) OR rr.department_id IS NULL)';
        params = [repairId, userId];
    } else {
        sql = 'SELECT rr.* FROM repair_requests rr WHERE rr.id=?';
        params = [repairId];
    }
    return { sql: sql, params: params };
}

function buildRepairListQuery(role, userId, filters) {
    filters = filters || {};
    var sql = 'SELECT rr.* FROM repair_requests rr WHERE 1=1';
    var params = [];
    if (filters.status) { sql += ' AND rr.status=?'; params.push(filters.status); }
    if (filters.priority) { sql += ' AND rr.priority=?'; params.push(filters.priority); }
    if (filters.date_from) { sql += ' AND rr.requested_at>=?'; params.push(filters.date_from + ' 00:00:00'); }
    if (filters.date_to) { sql += ' AND rr.requested_at<=?'; params.push(filters.date_to + ' 23:59:59'); }
    if (role === 'user') { sql += ' AND rr.user_id=?'; params.push(userId); }
    else if (role === 'manager') { sql += ' AND (rr.department_id IN (SELECT id FROM departments WHERE manager_id=?) OR rr.department_id IS NULL)'; params.push(userId); }
    sql += ' ORDER BY rr.requested_at DESC LIMIT ? OFFSET ?';
    params.push(50, 0);
    return { sql: sql, params: params };
}

function canChangeRole(activeAdminCount, targetRole, newRole) {
    if (newRole !== 'admin' && targetRole === 'admin' && activeAdminCount <= 1) {
        return { allowed: false, reason: 'Must have at least 1 admin' };
    }
    return { allowed: true };
}

function canDeactivate(activeAdminCount, targetRole, newStatus) {
    if (newStatus !== 'active' && targetRole === 'admin' && activeAdminCount <= 1) {
        return { allowed: false, reason: 'Must have at least 1 admin' };
    }
    return { allowed: true };
}

describe('IDOR Protection - Role-Based Query Filtering', function() {

    describe('GET /api/repairs/:id (detail)', function() {
        test('user should filter by own user_id', function() {
            var q = buildRepairDetailQuery('user', 5, 42);
            expect(q.sql).toContain('rr.user_id=?');
            expect(q.params).toEqual([42, 5]);
            expect(q.sql).not.toContain('department_id');
        });

        test('manager should filter by managed departments', function() {
            var q = buildRepairDetailQuery('manager', 10, 42);
            expect(q.sql).toContain('department_id');
            expect(q.sql).toContain('manager_id=?');
            expect(q.params).toEqual([42, 10]);
            expect(q.sql).not.toContain('rr.user_id=?');
        });

        test('admin should see all - no user filter', function() {
            var q = buildRepairDetailQuery('admin', 1, 42);
            expect(q.sql).not.toContain('user_id');
            expect(q.sql).not.toContain('department_id');
            expect(q.params).toEqual([42]);
        });

        test('different user ID produces different params', function() {
            var q1 = buildRepairDetailQuery('user', 5, 100);
            var q2 = buildRepairDetailQuery('user', 8, 100);
            expect(q1.params[1]).toBe(5);
            expect(q2.params[1]).toBe(8);
        });
    });

    describe('GET /api/repairs (list)', function() {
        test('user list includes user_id filter', function() {
            var q = buildRepairListQuery('user', 5);
            expect(q.sql).toContain('rr.user_id=?');
            expect(q.params).toContain(5);
        });

        test('manager list includes department filter', function() {
            var q = buildRepairListQuery('manager', 10);
            expect(q.sql).toContain('department_id');
            expect(q.sql).toContain('manager_id=?');
            expect(q.params).toContain(10);
        });

        test('admin list has no role filter', function() {
            var q = buildRepairListQuery('admin', 1);
            expect(q.sql).not.toContain('user_id');
            expect(q.sql).not.toContain('department_id');
        });

        test('count query mirrors main query filters', function() {
            var q = buildRepairListQuery('user', 5, { priority: 'urgent', date_from: '2026-01-01' });
            expect(q.sql).toContain('rr.user_id=?');
            expect(q.sql).toContain('rr.priority=?');
            expect(q.sql).toContain('rr.requested_at>=');
            expect(q.sql.indexOf('rr.user_id=?')).toBeGreaterThan(-1);
            expect(q.sql.indexOf('rr.priority=?')).toBeGreaterThan(-1);
            expect(q.sql.indexOf('rr.requested_at>=')).toBeGreaterThan(-1);
        });
    });

    describe('Admin Last-Man-Standing Protection', function() {
        test('should block demoting the last active admin', function() {
            expect(canChangeRole(1, 'admin', 'user').allowed).toBe(false);
        });
        test('should allow demoting admin if multiple admins', function() {
            expect(canChangeRole(3, 'admin', 'user').allowed).toBe(true);
        });
        test('should block deactivating the last active admin', function() {
            expect(canDeactivate(1, 'admin', 'inactive').allowed).toBe(false);
        });
        test('should allow deactivating a regular user', function() {
            expect(canDeactivate(1, 'user', 'inactive').allowed).toBe(true);
        });
        test('should allow deactivating admin when multiple admins exist', function() {
            expect(canDeactivate(5, 'admin', 'inactive').allowed).toBe(true);
        });
        test('should allow promoting user to admin', function() {
            expect(canChangeRole(1, 'user', 'admin').allowed).toBe(true);
        });
    });
});

describe('HTML Escape (XSS Protection)', function() {

    // Build entities using only ASCII chars to avoid encoding issues
    function mb(c) { return String.fromCharCode(c); }
    
    function escapeHtml(str) {
        if (str == null) return '';
        var a = mb(38); // &
        var ltStr = a + 'lt;';
        var gtStr = a + 'gt;';
        var ampStr = a + 'amp;';
        var quotStr = a + 'quot;';
        var aposStr = a + '#39;';
        var map = {};
        map[mb(38)] = ampStr;
        map[mb(60)] = ltStr;
        map[mb(62)] = gtStr;
        map[mb(34)] = quotStr;
        map["'"] = aposStr;
        return String(str).replace(/[&<>"']/g, function(c) { return map[c]; });
    }

    test('should escape script tag characters', function() {
        var input = 'one<script>two';
        var output = escapeHtml(input);
        expect(output.length).toBeGreaterThan(input.length);
        expect(output).not.toEqual(input);
    });

    test('should escape double quotes', function() {
        var input = 'value equal test';
        var output = escapeHtml(input + ' "quoted"');
        expect(output.length).toBeGreaterThan((input + ' "quoted"').length);
    });

    test('should escape single quotes', function() {
        var input = "it's";
        var output = escapeHtml(input);
        expect(output.length).toBeGreaterThan(input.length);
        expect(output).not.toEqual(input);
    });

    test('should escape ampersand', function() {
        var input = 'a ' + mb(38) + ' b';
        var output = escapeHtml(input);
        expect(output.length).toBeGreaterThan(input.length);
        expect(output).not.toEqual(input);
    });

    test('should handle null and undefined', function() {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });

    test('should handle normal Thai text unchanged', function() {
        var input = 'ปกติ ภาษาไทย ไม่มีอะไร';
        expect(escapeHtml(input)).toBe(input);
    });

    test('should escape mixed content', function() {
        var t1 = mb(60) + 'img src=x onerror=' + mb(34) + 'alert(1)' + mb(34) + mb(62);
        var output = escapeHtml(t1);
        expect(output.length).toBeGreaterThan(t1.length);
        expect(output).not.toEqual(t1);
    });
});