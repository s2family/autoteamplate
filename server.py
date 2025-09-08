from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash
import sqlite3
import json
import os
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import uuid

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this-in-production'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Tạo thư mục uploads nếu chưa tồn tại
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def init_database():
    """Khởi tạo database và các bảng cần thiết"""
    conn = sqlite3.connect('data.db')
    cursor = conn.cursor()
    
    # Bảng users
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Bảng automation_scenarios
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS automation_scenarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            steps TEXT NOT NULL,
            is_public BOOLEAN DEFAULT 0,
            created_by INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users (id)
        )
    ''')
    
    # Tạo admin mặc định nếu chưa có
    cursor.execute('SELECT COUNT(*) FROM users WHERE role = "admin"')
    admin_count = cursor.fetchone()[0]
    
    if admin_count == 0:
        admin_password = generate_password_hash('admin123')
        cursor.execute('''
            INSERT INTO users (username, password_hash, role) 
            VALUES (?, ?, ?)
        ''', ('admin', admin_password, 'admin'))
        
    # Tạo user demo nếu chưa có
    cursor.execute('SELECT COUNT(*) FROM users WHERE username = "demo"')
    demo_count = cursor.fetchone()[0]
    
    if demo_count == 0:
        demo_password = generate_password_hash('demo123')
        cursor.execute('''
            INSERT INTO users (username, password_hash, role) 
            VALUES (?, ?, ?)
        ''', ('demo', demo_password, 'user'))
    
    conn.commit()
    conn.close()

def get_db_connection():
    """Tạo kết nối database"""
    conn = sqlite3.connect('data.db')
    conn.row_factory = sqlite3.Row
    return conn

def login_required(f):
    """Decorator yêu cầu đăng nhập"""
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

def admin_required(f):
    """Decorator yêu cầu quyền admin"""
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        
        conn = get_db_connection()
        user = conn.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],)).fetchone()
        conn.close()
        
        if not user or user['role'] != 'admin':
            flash('Access denied. Admin privileges required.', 'error')
            return redirect(url_for('automation'))  # Updated redirect to automation
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

# Routes cho giao diện web
@app.route('/')
def index():
    """Trang chủ - chuyển hướng dựa trên trạng thái đăng nhập"""
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    conn = get_db_connection()
    user = conn.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    conn.close()
    
    if user and user['role'] == 'admin':
        return redirect(url_for('admin'))
    else:
        return redirect(url_for('automation'))  # Updated redirect to automation

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Trang đăng nhập"""
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        conn = get_db_connection()
        user = conn.execute(
            'SELECT id, username, password_hash, role FROM users WHERE username = ?', 
            (username,)
        ).fetchone()
        conn.close()
        
        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['role'] = user['role']
            
            flash(f'Welcome back, {username}!', 'success')
            
            if user['role'] == 'admin':
                return redirect(url_for('admin'))
            else:
                return redirect(url_for('automation'))  # Updated redirect to automation
        else:
            flash('Invalid username or password', 'error')
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    """Đăng xuất"""
    session.clear()
    flash('You have been logged out', 'info')
    return redirect(url_for('login'))

@app.route('/automation')  # Updated route to automation
@login_required
def automation():
    """Trang chính cho user"""
    conn = get_db_connection()
    
    # Lấy các scenario công khai và của user hiện tại
    scenarios = conn.execute('''
        SELECT s.*, u.username as creator_name
        FROM automation_scenarios s
        LEFT JOIN users u ON s.created_by = u.id
        WHERE s.is_public = 1 OR s.created_by = ?
        ORDER BY s.updated_at DESC
    ''', (session['user_id'],)).fetchall()
    
    conn.close()
    
    return render_template('automation.html', scenarios=scenarios)  # Updated render template to automation.html

@app.route('/admin')
@admin_required
def admin():
    """Trang quản trị admin"""
    conn = get_db_connection()
    
    # Lấy tất cả scenarios
    scenarios = conn.execute('''
        SELECT s.*, u.username as creator_name
        FROM automation_scenarios s
        LEFT JOIN users u ON s.created_by = u.id
        ORDER BY s.updated_at DESC
    ''').fetchall()
    
    # Lấy thống kê
    stats = {}
    stats['total_scenarios'] = conn.execute('SELECT COUNT(*) FROM automation_scenarios').fetchone()[0]
    stats['public_scenarios'] = conn.execute('SELECT COUNT(*) FROM automation_scenarios WHERE is_public = 1').fetchone()[0]
    stats['total_users'] = conn.execute('SELECT COUNT(*) FROM users').fetchone()[0]
    
    conn.close()
    
    return render_template('admin.html', scenarios=scenarios, stats=stats)

# API Routes
@app.route('/api/scenarios', methods=['GET'])
def api_get_scenarios():
    """API: Lấy danh sách scenarios công khai"""
    conn = get_db_connection()
    scenarios = conn.execute('''
        SELECT id, name, description, steps, is_public, created_at, updated_at
        FROM automation_scenarios 
        WHERE is_public = 1
        ORDER BY updated_at DESC
    ''').fetchall()
    conn.close()
    
    result = []
    for scenario in scenarios:
        steps_data = json.loads(scenario['steps']) if scenario['steps'] else []
        result.append({
            'id': scenario['id'],
            'name': scenario['name'],
            'description': scenario['description'],
            'steps': steps_data,
            'is_public': bool(scenario['is_public']),
            'created_at': scenario['created_at'],
            'updated_at': scenario['updated_at']
        })
    
    return jsonify(result)

@app.route('/api/scenarios/<int:scenario_id>', methods=['GET'])
def api_get_scenario(scenario_id):
    """API: Lấy chi tiết một scenario"""
    conn = get_db_connection()
    scenario = conn.execute('''
        SELECT id, name, description, steps, is_public, created_at, updated_at
        FROM automation_scenarios 
        WHERE id = ? AND is_public = 1
    ''', (scenario_id,)).fetchone()
    conn.close()
    
    if not scenario:
        return jsonify({'error': 'Scenario not found or not public'}), 404
    
    steps_data = json.loads(scenario['steps']) if scenario['steps'] else []
    result = {
        'id': scenario['id'],
        'name': scenario['name'],
        'description': scenario['description'],
        'steps': steps_data,
        'is_public': bool(scenario['is_public']),
        'created_at': scenario['created_at'],
        'updated_at': scenario['updated_at']
    }
    
    return jsonify(result)

# Thêm route này vào server.py
@app.route('/api/scenarios/<int:scenario_id>/edit', methods=['GET'])
@login_required
def api_get_scenario_for_edit(scenario_id):
    """API: Lấy chi tiết scenario để edit"""
    try:
        conn = get_db_connection()
        
        # Kiểm tra quyền truy cập
        scenario = conn.execute('''
            SELECT s.*, u.username as creator_name
            FROM automation_scenarios s
            LEFT JOIN users u ON s.created_by = u.id
            WHERE s.id = ?
        ''', (scenario_id,)).fetchone()
        
        if not scenario:
            conn.close()
            return jsonify({'error': 'Scenario not found'}), 404
        
        user = conn.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],)).fetchone()
        
        # Kiểm tra quyền: chỉ owner hoặc admin mới có thể edit
        if scenario['created_by'] != session['user_id'] and user['role'] != 'admin':
            conn.close()
            return jsonify({'error': 'Permission denied'}), 403
        
        conn.close()
        
        # Parse steps data
        steps_data = json.loads(scenario['steps']) if scenario['steps'] else []
        
        result = {
            'id': scenario['id'],
            'name': scenario['name'],
            'description': scenario['description'] or '',
            'steps': steps_data,
            'is_public': bool(scenario['is_public']),
            'created_by': scenario['created_by'],
            'creator_name': scenario['creator_name'],
            'created_at': scenario['created_at'],
            'updated_at': scenario['updated_at']
        }
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/scenarios/update', methods=['POST'])
@login_required
def update_scenario():
    # Lấy dữ liệu từ form
    scenario_id = request.form['id']
    name = request.form['name']
    description = request.form['description']
    
    conn = get_db_connection()
    conn.execute('''
        UPDATE automation_scenarios 
        SET name = ?, description = ? 
        WHERE id = ?
    ''', (name, description, scenario_id))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Workflow updated successfully'}), 200


@app.route('/api/scenarios', methods=['POST'])
@login_required
def api_create_scenario():
    """API: Tạo scenario mới"""
    try:
        data = request.get_json()
        
        if not data or 'name' not in data or 'steps' not in data:
            return jsonify({'error': 'Missing required fields: name, steps'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO automation_scenarios (name, description, steps, is_public, created_by, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            data['name'],
            data.get('description', ''),
            json.dumps(data['steps']),
            data.get('is_public', False),
            session['user_id'],
            datetime.now().isoformat()
        ))
        
        scenario_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return jsonify({'id': scenario_id, 'message': 'Scenario created successfully'}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/scenarios/<int:scenario_id>', methods=['PUT'])
@login_required
def api_update_scenario(scenario_id):
    """API: Cập nhật scenario"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        conn = get_db_connection()
        
        # Kiểm tra quyền sở hữu hoặc admin
        scenario = conn.execute('''
            SELECT created_by FROM automation_scenarios WHERE id = ?
        ''', (scenario_id,)).fetchone()
        
        if not scenario:
            conn.close()
            return jsonify({'error': 'Scenario not found'}), 404
        
        user = conn.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],)).fetchone()
        
        if scenario['created_by'] != session['user_id'] and user['role'] != 'admin':
            conn.close()
            return jsonify({'error': 'Permission denied'}), 403
        
        # Cập nhật scenario
        update_fields = []
        update_values = []
        
        if 'name' in data:
            update_fields.append('name = ?')
            update_values.append(data['name'])
        
        if 'description' in data:
            update_fields.append('description = ?')
            update_values.append(data['description'])
        
        if 'steps' in data:
            update_fields.append('steps = ?')
            update_values.append(json.dumps(data['steps']))
        
        if 'is_public' in data:
            update_fields.append('is_public = ?')
            update_values.append(data['is_public'])
        
        update_fields.append('updated_at = ?')
        update_values.append(datetime.now().isoformat())
        update_values.append(scenario_id)
        
        conn.execute(f'''
            UPDATE automation_scenarios 
            SET {', '.join(update_fields)}
            WHERE id = ?
        ''', update_values)
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Scenario updated successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/scenarios/<int:scenario_id>', methods=['DELETE'])
@login_required
def api_delete_scenario(scenario_id):
    """API: Xóa scenario"""
    try:
        conn = get_db_connection()
        
        # Kiểm tra quyền sở hữu hoặc admin
        scenario = conn.execute('''
            SELECT created_by FROM automation_scenarios WHERE id = ?
        ''', (scenario_id,)).fetchone()
        
        if not scenario:
            conn.close()
            return jsonify({'error': 'Scenario not found'}), 404
        
        user = conn.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],)).fetchone()
        
        if scenario['created_by'] != session['user_id'] and user['role'] != 'admin':
            conn.close()
            return jsonify({'error': 'Permission denied'}), 403
        
        # Xóa scenario
        conn.execute('DELETE FROM automation_scenarios WHERE id = ?', (scenario_id,))
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Scenario deleted successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Routes cho AJAX requests từ giao diện web
@app.route('/web/scenarios', methods=['POST'])
@login_required
def web_create_scenario():
    """Web: Tạo scenario mới từ form"""
    try:
        name = request.form.get('name')
        description = request.form.get('description', '')
        is_public = 'is_public' in request.form
        steps_json = request.form.get('steps')
        
        if not name or not steps_json:
            flash('Name and steps are required', 'error')
            return redirect(url_for('automation'))  # Updated redirect to automation
        
        try:
            steps = json.loads(steps_json)
        except json.JSONDecodeError:
            flash('Invalid steps format', 'error')
            return redirect(url_for('automation'))  # Updated redirect to automation
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO automation_scenarios (name, description, steps, is_public, created_by, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            name,
            description,
            json.dumps(steps),
            is_public,
            session['user_id'],
            datetime.now().isoformat()
        ))
        
        conn.commit()
        conn.close()
        
        flash('Scenario created successfully!', 'success')
        return redirect(url_for('automation'))  # Updated redirect to automation
        
    except Exception as e:
        flash(f'Error creating scenario: {str(e)}', 'error')
        return redirect(url_for('automation'))  # Updated redirect to automation

@app.route('/web/scenarios/<int:scenario_id>', methods=['POST'])
@login_required
def web_update_scenario(scenario_id):
    """Web: Cập nhật scenario từ form"""
    try:
        action = request.form.get('action')
        
        conn = get_db_connection()
        
        # Kiểm tra quyền
        scenario = conn.execute('''
            SELECT created_by FROM automation_scenarios WHERE id = ?
        ''', (scenario_id,)).fetchone()
        
        if not scenario:
            flash('Scenario not found', 'error')
            conn.close()
            return redirect(url_for('automation'))  # Updated redirect to automation
        
        user = conn.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],)).fetchone()
        
        if scenario['created_by'] != session['user_id'] and user['role'] != 'admin':
            flash('Permission denied', 'error')
            conn.close()
            return redirect(url_for('automation'))  # Updated redirect to automation
        
        if action == 'toggle_public':
            # Toggle trạng thái công khai
            conn.execute('''
                UPDATE automation_scenarios 
                SET is_public = NOT is_public, updated_at = ?
                WHERE id = ?
            ''', (datetime.now().isoformat(), scenario_id))
            flash('Scenario visibility updated', 'success')
            
        elif action == 'delete':
            # Xóa scenario
            conn.execute('DELETE FROM automation_scenarios WHERE id = ?', (scenario_id,))
            flash('Scenario deleted successfully', 'success')
            
        elif action == 'update':
            # Cập nhật thông tin scenario
            name = request.form.get('name')
            description = request.form.get('description', '')
            is_public = 'is_public' in request.form
            steps_json = request.form.get('steps')
            
            if not name or not steps_json:
                flash('Name and steps are required', 'error')
                conn.close()
                return redirect(url_for('automation'))  # Updated redirect to automation
            
            try:
                steps = json.loads(steps_json)
            except json.JSONDecodeError:
                flash('Invalid steps format', 'error')
                conn.close()
                return redirect(url_for('automation'))  # Updated redirect to automation
            
            conn.execute('''
                UPDATE automation_scenarios 
                SET name = ?, description = ?, steps = ?, is_public = ?, updated_at = ?
                WHERE id = ?
            ''', (
                name,
                description,
                json.dumps(steps),
                is_public,
                datetime.now().isoformat(),
                scenario_id
            ))
            flash('Scenario updated successfully', 'success')
        
        conn.commit()
        conn.close()
        
        # Redirect dựa trên role
        if session.get('role') == 'admin':
            return redirect(url_for('admin'))
        else:
            return redirect(url_for('automation'))  # Updated redirect to automation
        
    except Exception as e:
        flash(f'Error: {str(e)}', 'error')
        if session.get('role') == 'admin':
            return redirect(url_for('admin'))
        else:
            return redirect(url_for('automation'))  # Updated redirect to automation

# Error handlers
@app.errorhandler(404)
def not_found_error(error):
    return render_template('login.html'), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

# Utility functions
def allowed_file(filename):
    """Kiểm tra file được phép upload"""
    ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'zip', 'json'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/upload', methods=['POST'])
@login_required
def upload_file():
    """Upload file tạm thời"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            # Tạo tên file unique
            unique_filename = f"{uuid.uuid4()}_{filename}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            file.save(filepath)
            
            return jsonify({
                'message': 'File uploaded successfully',
                'filename': unique_filename,
                'original_filename': filename
            })
        else:
            return jsonify({'error': 'File type not allowed'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Khởi tạo database khi start server
    init_database()
    
    # Chạy Flask server
    print("Starting Flask Server...")
    print("Default Admin: username='admin', password='admin123'")
    print("Default User: username='demo', password='demo123'")
    print("Server running at: http://localhost:5000")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
