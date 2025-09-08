import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import requests
import json
import threading
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import Select
from selenium.common.exceptions import (
    TimeoutException, 
    NoSuchElementException, 
    WebDriverException,
    NoSuchWindowException,
    ElementNotInteractableException
)
import os
import subprocess
import platform
from pathlib import Path

class AutomationApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Enhanced Browser Automation Tool v2.0")
        self.root.geometry("900x700")
        
        # API Configuration
        self.api_base_url = "http://localhost:5000/api"
        
        # Variables
        self.scenarios = []
        self.selected_scenario = None
        self.upload_folder = tk.StringVar()
        self.download_path = tk.StringVar()
        self.show_browser = tk.BooleanVar(value=True)
        self.driver = None
        
        # Enhanced tab management
        self.tab_handles = {}  # Map tab variable names to window handles
        self.current_tab = None
        
        # Variable storage for data extraction
        self.variables = {}
        
        # Execution state
        self.execution_stopped = False
        
        self.setup_ui()
        self.load_scenarios()
    
    def setup_ui(self):
        """Thiết lập giao diện người dùng với các cải tiến"""
        # Main container
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Configure grid weights
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        
        # Title with version info
        title_label = ttk.Label(main_frame, text="Enhanced Browser Automation Tool v2.0", 
                               font=("Arial", 16, "bold"))
        title_label.grid(row=0, column=0, columnspan=3, pady=(0, 20))
        
        # API Settings Frame
        api_frame = ttk.LabelFrame(main_frame, text="API Settings", padding="10")
        api_frame.grid(row=1, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        api_frame.columnconfigure(1, weight=1)
        
        ttk.Label(api_frame, text="Flask API URL:").grid(row=0, column=0, sticky=tk.W)
        self.api_url_entry = ttk.Entry(api_frame, width=50)
        self.api_url_entry.insert(0, "http://localhost:5000/api")
        self.api_url_entry.grid(row=0, column=1, sticky=(tk.W, tk.E), padx=(10, 5))
        
        refresh_btn = ttk.Button(api_frame, text="Refresh Scenarios", 
                                command=self.load_scenarios)
        refresh_btn.grid(row=0, column=2, padx=(5, 0))
        
        # Scenarios Frame
        scenarios_frame = ttk.LabelFrame(main_frame, text="Available Scenarios", padding="10")
        scenarios_frame.grid(row=2, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        scenarios_frame.columnconfigure(0, weight=1)
        scenarios_frame.rowconfigure(1, weight=1)
        
        # Scenarios listbox with scrollbar
        listbox_frame = ttk.Frame(scenarios_frame)
        listbox_frame.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        listbox_frame.columnconfigure(0, weight=1)
        listbox_frame.rowconfigure(0, weight=1)
        
        self.scenarios_listbox = tk.Listbox(listbox_frame, height=8)
        self.scenarios_listbox.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        self.scenarios_listbox.bind('<<ListboxSelect>>', self.on_scenario_select)
        
        scrollbar = ttk.Scrollbar(listbox_frame, orient="vertical")
        scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        self.scenarios_listbox.config(yscrollcommand=scrollbar.set)
        scrollbar.config(command=self.scenarios_listbox.yview)
        
        # Enhanced Configuration Frame
        config_frame = ttk.LabelFrame(main_frame, text="Configuration", padding="10")
        config_frame.grid(row=3, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        config_frame.columnconfigure(1, weight=1)
        
        # Browser visibility
        ttk.Label(config_frame, text="Browser Visibility:").grid(row=0, column=0, sticky=tk.W)
        browser_frame = ttk.Frame(config_frame)
        browser_frame.grid(row=0, column=1, sticky=tk.W, padx=(10, 0))
        
        ttk.Radiobutton(browser_frame, text="Show Browser", variable=self.show_browser, 
                       value=True).pack(side=tk.LEFT)
        ttk.Radiobutton(browser_frame, text="Hide Browser (Headless)", 
                       variable=self.show_browser, value=False).pack(side=tk.LEFT, padx=(20, 0))
        
        # Upload folder configuration
        self.upload_label = ttk.Label(config_frame, text="Upload Folder:")
        self.upload_entry = ttk.Entry(config_frame, textvariable=self.upload_folder, state="disabled")
        self.upload_btn = ttk.Button(config_frame, text="Browse", 
                                    command=self.browse_upload_folder, state="disabled")
        
        # Download path configuration
        self.download_label = ttk.Label(config_frame, text="Download Path:")
        self.download_entry = ttk.Entry(config_frame, textvariable=self.download_path, state="disabled")
        self.download_btn = ttk.Button(config_frame, text="Browse", 
                                      command=self.browse_download_path, state="disabled")
        
        # Enhanced Control Frame
        control_frame = ttk.Frame(main_frame)
        control_frame.grid(row=4, column=0, columnspan=3, pady=(0, 10))
        
        self.run_btn = ttk.Button(control_frame, text="RUN AUTOMATION", 
                                 command=self.run_automation, state="disabled",
                                 style="Accent.TButton")
        self.run_btn.pack(side=tk.LEFT, padx=(0, 10))
        
        self.stop_btn = ttk.Button(control_frame, text="STOP", 
                                  command=self.stop_automation, state="disabled")
        self.stop_btn.pack(side=tk.LEFT, padx=(0, 10))
        
        # Debug variables button
        self.debug_btn = ttk.Button(control_frame, text="VIEW VARIABLES", 
                                   command=self.show_variables, state="disabled")
        self.debug_btn.pack(side=tk.LEFT)
        
        # Status and Log Frame
        log_frame = ttk.LabelFrame(main_frame, text="Status & Logs", padding="10")
        log_frame.grid(row=5, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S))
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(1, weight=1)
        
        # Status bar
        self.status_var = tk.StringVar(value="Ready")
        status_label = ttk.Label(log_frame, textvariable=self.status_var, 
                                font=("Arial", 10, "bold"))
        status_label.grid(row=0, column=0, sticky=tk.W, pady=(0, 5))
        
        # Enhanced log text area
        self.log_text = scrolledtext.ScrolledText(log_frame, height=12, state="disabled")
        self.log_text.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Configure grid weights for main frame
        main_frame.rowconfigure(2, weight=1)
        main_frame.rowconfigure(5, weight=1)
    
    def log_message(self, message, level="INFO"):
        """Ghi log với level khác nhau"""
        timestamp = time.strftime('%H:%M:%S')
        level_prefix = {
            "INFO": "ℹ️",
            "SUCCESS": "✅", 
            "WARNING": "⚠️",
            "ERROR": "❌",
            "DEBUG": "🐛"
        }.get(level, "ℹ️")
        
        self.log_text.config(state="normal")
        self.log_text.insert(tk.END, f"[{timestamp}] {level_prefix} {message}\n")
        self.log_text.see(tk.END)
        self.log_text.config(state="disabled")
        self.root.update_idletasks()
    
    def update_status(self, status):
        """Cập nhật trạng thái"""
        self.status_var.set(status)
        self.root.update_idletasks()
    
    def load_scenarios(self):
        """Tải danh sách kịch bản từ Flask API"""
        try:
            self.update_status("Loading scenarios...")
            api_url = self.api_url_entry.get().strip()
            if not api_url:
                api_url = "http://localhost:5000/api"
            
            response = requests.get(f"{api_url}/scenarios", timeout=10)
            
            if response.status_code == 200:
                self.scenarios = response.json()
                self.populate_scenarios_list()
                self.log_message(f"Loaded {len(self.scenarios)} scenarios successfully", "SUCCESS")
                self.update_status("Ready")
            else:
                raise Exception(f"Server returned status code: {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            error_msg = f"Failed to connect to Flask API: {str(e)}"
            self.log_message(error_msg, "ERROR")
            self.update_status("Connection failed")
            messagebox.showerror("Connection Error", error_msg)
        except Exception as e:
            error_msg = f"Error loading scenarios: {str(e)}"
            self.log_message(error_msg, "ERROR")
            self.update_status("Error")
            messagebox.showerror("Error", error_msg)
    
    def populate_scenarios_list(self):
        """Điền danh sách kịch bản vào listbox"""
        self.scenarios_listbox.delete(0, tk.END)
        for scenario in self.scenarios:
            status = "🟢" if scenario.get('is_public', False) else "🔴"
            workflow_type = self.get_workflow_type_indicator(scenario.get('steps', ''))
            self.scenarios_listbox.insert(tk.END, f"{status} {workflow_type} {scenario['name']}")
    
    def get_workflow_type_indicator(self, steps_data):
        """Xác định loại workflow và trả về indicator"""
        try:
            if isinstance(steps_data, str):
                data = json.loads(steps_data)
            else:
                data = steps_data
                
            if isinstance(data, dict) and data.get('workflow_type') == 'visual':
                return "🎨"  # Visual workflow
            else:
                return "📋"  # Linear workflow
        except:
            return "📋"  # Default to linear
    
    def on_scenario_select(self, event):
        """Xử lý khi chọn kịch bản"""
        selection = self.scenarios_listbox.curselection()
        if not selection:
            return
        
        index = selection[0]
        self.selected_scenario = self.scenarios[index]
        
        self.log_message(f"Selected scenario: {self.selected_scenario['name']}", "INFO")
        
        # Parse workflow data
        steps_data = self.selected_scenario.get('steps', [])
        if isinstance(steps_data, str):
            try:
                steps_data = json.loads(steps_data)
            except json.JSONDecodeError:
                self.log_message("Invalid JSON in scenario steps", "ERROR")
                return
        
        # Extract steps based on workflow type
        if isinstance(steps_data, dict) and steps_data.get('workflow_type') == 'visual':
            steps = self.convert_visual_to_linear(steps_data)
        else:
            steps = steps_data if isinstance(steps_data, list) else []
        
        # Check requirements
        needs_upload = any(step.get('type') in ['upload'] for step in steps)
        needs_download = any(step.get('type') in ['download'] for step in steps)
        
        # Show/hide upload configuration
        if needs_upload:
            self.upload_label.grid(row=1, column=0, sticky=tk.W, pady=(10, 0))
            self.upload_entry.grid(row=1, column=1, sticky=(tk.W, tk.E), padx=(10, 5), pady=(10, 0))
            self.upload_btn.grid(row=1, column=2, padx=(5, 0), pady=(10, 0))
            self.upload_entry.config(state="normal")
            self.upload_btn.config(state="normal")
        else:
            self.upload_label.grid_remove()
            self.upload_entry.grid_remove()
            self.upload_btn.grid_remove()
            self.upload_entry.config(state="disabled")
            self.upload_btn.config(state="disabled")
        
        # Show/hide download configuration
        if needs_download:
            row = 2 if needs_upload else 1
            self.download_label.grid(row=row, column=0, sticky=tk.W, pady=(10, 0))
            self.download_entry.grid(row=row, column=1, sticky=(tk.W, tk.E), padx=(10, 5), pady=(10, 0))
            self.download_btn.grid(row=row, column=2, padx=(5, 0), pady=(10, 0))
            self.download_entry.config(state="normal")
            self.download_btn.config(state="normal")
        else:
            self.download_label.grid_remove()
            self.download_entry.grid_remove()
            self.download_btn.grid_remove()
            self.download_entry.config(state="disabled")
            self.download_btn.config(state="disabled")
        
        # Enable buttons
        self.run_btn.config(state="normal")
    
    def convert_visual_to_linear(self, visual_data):
        """Chuyển đổi visual workflow thành linear steps để thực thi"""
        if not visual_data.get('nodes') or not visual_data.get('connections'):
            return []
        
        # Build execution order from visual workflow
        nodes_dict = {node['id']: node for node in visual_data['nodes']}
        connections = visual_data['connections']
        
        # Find start node
        start_node_id = visual_data.get('startNode')
        if not start_node_id:
            # Fallback: find node marked as start
            for node in visual_data['nodes']:
                if node.get('isStart') or node.get('type') == 'start':
                    start_node_id = node['id']
                    break
        
        if not start_node_id:
            self.log_message("No start node found in visual workflow", "ERROR")
            return []
        
        # Traverse workflow to build execution sequence
        execution_order = []
        visited = set()
        
        def traverse(node_id, path=[]):
            if node_id in visited or node_id in path:  # Prevent infinite loops
                return
            
            visited.add(node_id)
            current_path = path + [node_id]
            
            node = nodes_dict.get(node_id)
            if not node or node.get('type') == 'start':
                # Continue to next nodes
                pass
            else:
                # Convert node to step
                step = self.convert_node_to_step(node)
                if step:
                    execution_order.append(step)
            
            # Find next nodes (success connections have priority)
            next_nodes = []
            for conn in connections:
                if conn['source'] == node_id:
                    if conn['type'] == 'success':
                        next_nodes.insert(0, conn['target'])  # Prioritize success paths
                    else:
                        next_nodes.append(conn['target'])
            
            # Continue traversal
            for next_node_id in next_nodes:
                traverse(next_node_id, current_path)
        
        traverse(start_node_id)
        return execution_order
    
    def convert_node_to_step(self, node):
        """Chuyển đổi node thành step format"""
        node_type = node.get('type')
        node_data = node.get('data', {})
        
        if not node_type or node_type == 'start':
            return None
        
        # Convert based on node type
        step = {
            'type': node_type,
            **node_data
        }
        
        return step
    
    def browse_upload_folder(self):
        """Chọn thư mục upload"""
        folder = filedialog.askdirectory(title="Select Upload Folder")
        if folder:
            self.upload_folder.set(folder)
            self.log_message(f"Upload folder set to: {folder}")
    
    def browse_download_path(self):
        """Chọn đường dẫn download"""
        folder = filedialog.askdirectory(title="Select Download Path")
        if folder:
            self.download_path.set(folder)
            self.log_message(f"Download path set to: {folder}")
    
    def setup_webdriver(self):
        """Thiết lập WebDriver với cải tiến"""
        try:
            chrome_options = Options()
            
            if not self.show_browser.get():
                chrome_options.add_argument("--headless")
                self.log_message("Running in headless mode")
            else:
                self.log_message("Running with visible browser")
            
            # Download preferences
            if self.download_path.get():
                prefs = {
                    "download.default_directory": self.download_path.get(),
                    "download.prompt_for_download": False,
                    "download.directory_upgrade": True,
                    "safebrowsing.enabled": True
                }
                chrome_options.add_experimental_option("prefs", prefs)
            
            # Additional options for stability
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--window-size=1920,1080")
            chrome_options.add_argument("--disable-web-security")
            chrome_options.add_argument("--allow-running-insecure-content")
            
            self.driver = webdriver.Chrome(options=chrome_options)
            self.driver.implicitly_wait(10)
            
            # Initialize tab management
            self.tab_handles = {"main_tab": self.driver.current_window_handle}
            self.current_tab = "main_tab"
            
            # Initialize variables
            self.variables = {}
            self.execution_stopped = False
            
            self.log_message("WebDriver initialized successfully", "SUCCESS")
            return True
            
        except Exception as e:
            error_msg = f"Failed to initialize WebDriver: {str(e)}"
            self.log_message(error_msg, "ERROR")
            messagebox.showerror("WebDriver Error", error_msg)
            return False
    
    def execute_step(self, step):
        """Thực hiện một bước trong kịch bản - Enhanced với các step mới"""
        if self.execution_stopped:
            return False
            
        step_type = step.get('type')
        self.log_message(f"Executing step: {step_type}")
        
        try:
            # BASIC ACTIONS
            if step_type == 'open_browser':
                return self.execute_open_browser(step)
            elif step_type == 'wait':
                return self.execute_wait(step)
            elif step_type == 'wait_element':
                return self.execute_wait_element(step)
            
            # NAVIGATION NODES (NEW)
            elif step_type == 'new_tab':
                return self.execute_new_tab(step)
            elif step_type == 'activate_tab':
                return self.execute_activate_tab(step)
            elif step_type == 'open_url':
                return self.execute_open_url(step)
            elif step_type == 'close_tab':
                return self.execute_close_tab(step)
            elif step_type == 'go_back':
                return self.execute_go_back(step)
            elif step_type == 'reload_page':
                return self.execute_reload_page(step)
            
            # USER INTERACTIONS (ENHANCED)
            elif step_type == 'click':
                return self.execute_click(step)
            elif step_type == 'type_text':
                return self.execute_type_text(step)
            elif step_type == 'scroll':
                return self.execute_scroll(step)
            
            # KEYBOARD NODES (NEW)
            elif step_type == 'press_key':
                return self.execute_press_key(step)
            
            # DATA NODES (NEW)
            elif step_type == 'element_exists':
                return self.execute_element_exists(step)
            elif step_type == 'get_text':
                return self.execute_get_text(step)
            
            # FILE OPERATIONS (ENHANCED)
            elif step_type == 'upload':
                return self.execute_upload(step)
            elif step_type == 'download':
                return self.execute_download(step)
            elif step_type == 'screenshot':
                return self.execute_screenshot(step)
            
            # CONTROL FLOW
            elif step_type == 'javascript':
                return self.execute_javascript(step)
            elif step_type == 'condition':
                return self.execute_condition(step)
            elif step_type == 'loop':
                return self.execute_loop(step)
            
            else:
                self.log_message(f"Unknown step type: {step_type}", "WARNING")
                return True
                
        except TimeoutException:
            error_msg = f"Timeout in step: {step_type}"
            self.log_message(error_msg, "ERROR")
            raise Exception(error_msg)
        except NoSuchElementException:
            error_msg = f"Element not found in step: {step_type}"
            self.log_message(error_msg, "ERROR")
            raise Exception(error_msg)
        except Exception as e:
            error_msg = f"Error in step {step_type}: {str(e)}"
            self.log_message(error_msg, "ERROR")
            raise Exception(error_msg)

    # BASIC ACTIONS IMPLEMENTATION
    def execute_open_browser(self, step):
        """Mở trang web trong browser"""
        url = step.get('url', 'about:blank')
        self.driver.get(url)
        self.log_message(f"Opened URL: {url}", "SUCCESS")
        return True

    def execute_wait(self, step):
        """Chờ thời gian cố định"""
        duration = step.get('duration', 1)
        self.log_message(f"Waiting for {duration} seconds...")
        time.sleep(duration)
        return True

    def execute_wait_element(self, step):
        """Chờ element xuất hiện"""
        xpath = step.get('xpath')
        timeout = step.get('timeout', 10)
        if xpath:
            self.log_message(f"Waiting for element: {xpath}")
            WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((By.XPATH, xpath))
            )
            self.log_message("Element found", "SUCCESS")
        else:
            self.log_message("No xpath provided for wait_element", "WARNING")
        return True

    # NAVIGATION NODES IMPLEMENTATION (NEW)
    def execute_new_tab(self, step):
        """Mở tab mới"""
        url = step.get('url', '')
        tab_variable = step.get('tab_variable', f'tab_{len(self.tab_handles)}')
        
        # Open new tab
        self.driver.execute_script("window.open('');")
        
        # Switch to new tab
        new_handle = None
        for handle in self.driver.window_handles:
            if handle not in self.tab_handles.values():
                new_handle = handle
                break
        
        if new_handle:
            self.tab_handles[tab_variable] = new_handle
            self.driver.switch_to.window(new_handle)
            self.current_tab = tab_variable
            
            if url:
                self.driver.get(url)
                self.log_message(f"Opened new tab '{tab_variable}' with URL: {url}", "SUCCESS")
            else:
                self.log_message(f"Opened new blank tab '{tab_variable}'", "SUCCESS")
        else:
            raise Exception("Failed to create new tab")
        
        return True

    def execute_activate_tab(self, step):
        """Chuyển đổi tab"""
        tab_variable = step.get('tab_variable', 'main_tab')
        
        if tab_variable in self.tab_handles:
            handle = self.tab_handles[tab_variable]
            try:
                self.driver.switch_to.window(handle)
                self.current_tab = tab_variable
                self.log_message(f"Switched to tab: {tab_variable}", "SUCCESS")
            except NoSuchWindowException:
                self.log_message(f"Tab '{tab_variable}' no longer exists", "ERROR")
                # Remove from tab handles
                del self.tab_handles[tab_variable]
                raise Exception(f"Tab '{tab_variable}' not found")
        else:
            raise Exception(f"Tab variable '{tab_variable}' not found")
        
        return True

    def execute_open_url(self, step):
        """Điều hướng đến URL trong tab hiện tại"""
        url = step.get('url', 'about:blank')
        self.driver.get(url)
        self.log_message(f"Navigated to URL: {url}", "SUCCESS")
        return True

    def execute_close_tab(self, step):
        """Đóng tab"""
        close_current = step.get('close_current', True)
        tab_variable = step.get('tab_variable', '')
        
        if close_current:
            # Close current tab
            if len(self.tab_handles) > 1:
                current_handle = self.driver.current_window_handle
                self.driver.close()
                
                # Remove from tab handles
                for var, handle in list(self.tab_handles.items()):
                    if handle == current_handle:
                        del self.tab_handles[var]
                        break
                
                # Switch to remaining tab
                remaining_handle = list(self.tab_handles.values())[0]
                self.driver.switch_to.window(remaining_handle)
                self.current_tab = list(self.tab_handles.keys())[0]
                
                self.log_message("Closed current tab", "SUCCESS")
            else:
                self.log_message("Cannot close the last remaining tab", "WARNING")
        else:
            # Close specific tab
            if tab_variable in self.tab_handles:
                handle = self.tab_handles[tab_variable]
                current_handle = self.driver.current_window_handle
                
                self.driver.switch_to.window(handle)
                self.driver.close()
                del self.tab_handles[tab_variable]
                
                # Switch back if we're not closing current tab
                if handle != current_handle and current_handle in self.tab_handles.values():
                    self.driver.switch_to.window(current_handle)
                else:
                    # Switch to any remaining tab
                    if self.tab_handles:
                        remaining_handle = list(self.tab_handles.values())[0]
                        self.driver.switch_to.window(remaining_handle)
                        self.current_tab = list(self.tab_handles.keys())[0]
                
                self.log_message(f"Closed tab: {tab_variable}", "SUCCESS")
            else:
                raise Exception(f"Tab variable '{tab_variable}' not found")
        
        return True

    def execute_go_back(self, step):
        """Quay lại trang trước"""
        steps = step.get('steps', 1)
        for _ in range(steps):
            self.driver.back()
            time.sleep(0.5)  # Small delay between back steps
        self.log_message(f"Went back {steps} step(s)", "SUCCESS")
        return True

    def execute_reload_page(self, step):
        """Tải lại trang"""
        force_reload = step.get('force_reload', False)
        if force_reload:
            # Force reload with Ctrl+F5
            ActionChains(self.driver).key_down(Keys.CONTROL).key_down(Keys.F5).key_up(Keys.F5).key_up(Keys.CONTROL).perform()
        else:
            self.driver.refresh()
        self.log_message("Page reloaded", "SUCCESS")
        return True

    # USER INTERACTIONS IMPLEMENTATION (ENHANCED)
    def execute_click(self, step):
        """Click element với các tùy chọn nâng cao"""
        xpath = step.get('xpath')
        click_type = step.get('click_type', 'single')
        wait_timeout = step.get('wait_timeout', 10)
        
        if xpath:
            self.log_message(f"Clicking element: {xpath} ({click_type})")
            element = WebDriverWait(self.driver, wait_timeout).until(
                EC.element_to_be_clickable((By.XPATH, xpath))
            )
            
            actions = ActionChains(self.driver)
            if click_type == 'double':
                actions.double_click(element).perform()
            elif click_type == 'right':
                actions.context_click(element).perform()
            else:  # single click
                element.click()
            
            self.log_message(f"{click_type.title()} click successful", "SUCCESS")
        else:
            self.log_message("No xpath provided for click", "WARNING")
        
        return True

    def execute_type_text(self, step):
        """Type text với các tùy chọn nâng cao"""
        xpath = step.get('xpath')
        text = step.get('text', '')
        clear_first = step.get('clear_first', True)
        typing_speed = step.get('typing_speed', 'normal')
        
        if xpath:
            self.log_message(f"Typing into element: {xpath}")
            element = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, xpath))
            )
            
            if clear_first:
                element.clear()
            
            # Simulate typing speed
            if typing_speed == 'slow':
                for char in text:
                    element.send_keys(char)
                    time.sleep(0.1)  # Human-like typing
            elif typing_speed == 'fast':
                element.send_keys(text)
            else:  # normal
                for char in text:
                    element.send_keys(char)
                    time.sleep(0.02)  # Slightly delayed typing
            
            self.log_message("Text input successful", "SUCCESS")
        else:
            self.log_message("No xpath provided for type_text", "WARNING")
        
        return True

    def execute_scroll(self, step):
        """Scroll trang hoặc element với các tùy chọn nâng cao"""
        direction = step.get('direction', 'down')
        pixels = step.get('pixels', 500)
        target_element = step.get('target_element', '')
        smooth = step.get('smooth', True)
        
        scroll_script = ""
        
        if target_element:
            # Scroll specific element
            try:
                element = self.driver.find_element(By.XPATH, target_element)
                if direction == 'up':
                    scroll_script = f"arguments[0].scrollTop -= {pixels};"
                elif direction == 'down':
                    scroll_script = f"arguments[0].scrollTop += {pixels};"
                elif direction == 'left':
                    scroll_script = f"arguments[0].scrollLeft -= {pixels};"
                elif direction == 'right':
                    scroll_script = f"arguments[0].scrollLeft += {pixels};"
                elif direction == 'top':
                    scroll_script = "arguments[0].scrollTop = 0;"
                elif direction == 'bottom':
                    scroll_script = "arguments[0].scrollTop = arguments[0].scrollHeight;"
                
                self.driver.execute_script(scroll_script, element)
                self.log_message(f"Scrolled element {direction}", "SUCCESS")
            except NoSuchElementException:
                self.log_message(f"Target element not found: {target_element}", "WARNING")
                return False
        else:
            # Scroll page
            if direction == 'up':
                scroll_script = f"window.scrollBy(0, -{pixels});"
            elif direction == 'down':
                scroll_script = f"window.scrollBy(0, {pixels});"
            elif direction == 'left':
                scroll_script = f"window.scrollBy(-{pixels}, 0);"
            elif direction == 'right':
                scroll_script = f"window.scrollBy({pixels}, 0);"
            elif direction == 'top':
                scroll_script = "window.scrollTo(0, 0);"
            elif direction == 'bottom':
                scroll_script = "window.scrollTo(0, document.body.scrollHeight);"
            
            if smooth:
                scroll_script = scroll_script.replace('scrollBy', 'scrollBy').replace('scrollTo', 'scrollTo')
                # Add smooth behavior for modern browsers
                if 'scrollBy' in scroll_script or 'scrollTo' in scroll_script:
                    scroll_script = scroll_script.replace(');', ', {behavior: "smooth"});')
            
            self.driver.execute_script(scroll_script)
            self.log_message(f"Scrolled page {direction}", "SUCCESS")
        
        return True

    # KEYBOARD NODES IMPLEMENTATION (NEW)
    def execute_press_key(self, step):
        """Nhấn phím hoặc tổ hợp phím"""
        key_combination = step.get('key_combination', 'Enter')
        modifier_keys = step.get('modifier_keys', '')
        hold_duration = step.get('hold_duration', 0.1)
        
        self.log_message(f"Pressing key combination: {key_combination}")
        
        # Map key names to Selenium Keys
        key_map = {
            'Enter': Keys.ENTER,
            'Escape': Keys.ESCAPE,
            'Space': Keys.SPACE,
            'Tab': Keys.TAB,
            'Backspace': Keys.BACKSPACE,
            'Delete': Keys.DELETE,
            'Home': Keys.HOME,
            'End': Keys.END,
            'PageUp': Keys.PAGE_UP,
            'PageDown': Keys.PAGE_DOWN,
            'ArrowUp': Keys.ARROW_UP,
            'ArrowDown': Keys.ARROW_DOWN,
            'ArrowLeft': Keys.ARROW_LEFT,
            'ArrowRight': Keys.ARROW_RIGHT,
            'F1': Keys.F1, 'F2': Keys.F2, 'F3': Keys.F3, 'F4': Keys.F4,
            'F5': Keys.F5, 'F6': Keys.F6, 'F7': Keys.F7, 'F8': Keys.F8,
            'F9': Keys.F9, 'F10': Keys.F10, 'F11': Keys.F11, 'F12': Keys.F12,
        }
        
        actions = ActionChains(self.driver)
        
        # Handle modifier keys
        modifiers = []
        if modifier_keys:
            if 'ctrl' in modifier_keys.lower():
                modifiers.append(Keys.CONTROL)
            if 'alt' in modifier_keys.lower():
                modifiers.append(Keys.ALT)
            if 'shift' in modifier_keys.lower():
                modifiers.append(Keys.SHIFT)
        
        # Press modifier keys
        for modifier in modifiers:
            actions.key_down(modifier)
        
        # Press main key
        main_key = key_map.get(key_combination, key_combination)
        actions.send_keys(main_key)
        
        # Release modifier keys
        for modifier in reversed(modifiers):
            actions.key_up(modifier)
        
        actions.perform()
        
        # Hold duration
        if hold_duration > 0.1:
            time.sleep(hold_duration - 0.1)
        
        self.log_message(f"Key press successful: {key_combination}", "SUCCESS")
        return True

    # DATA NODES IMPLEMENTATION (NEW)
    def execute_element_exists(self, step):
        """Kiểm tra sự tồn tại của element"""
        xpath = step.get('xpath')
        save_result = step.get('save_result', True)
        result_variable = step.get('result_variable', 'element_exists')
        
        if xpath:
            try:
                self.driver.find_element(By.XPATH, xpath)
                result = True
                self.log_message(f"Element exists: {xpath}", "SUCCESS")
            except NoSuchElementException:
                result = False
                self.log_message(f"Element does not exist: {xpath}", "INFO")
            
            if save_result:
                self.variables[result_variable] = result
                self.log_message(f"Saved result to variable '{result_variable}': {result}", "DEBUG")
        else:
            self.log_message("No xpath provided for element_exists", "WARNING")
            result = False
        
        return True

    def execute_get_text(self, step):
        """Trích xuất text từ element"""
        xpath = step.get('xpath')
        attribute = step.get('attribute', 'text')
        save_variable = step.get('save_variable', 'extracted_text')
        
        if xpath:
            self.log_message(f"Getting {attribute} from element: {xpath}")
            element = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.XPATH, xpath))
            )
            
            if attribute == 'text':
                extracted_value = element.text
            else:
                extracted_value = element.get_attribute(attribute)
            
            self.variables[save_variable] = extracted_value
            self.log_message(f"Extracted {attribute}: '{extracted_value}' -> saved to '{save_variable}'", "SUCCESS")
        else:
            self.log_message("No xpath provided for get_text", "WARNING")
        
        return True

    # FILE OPERATIONS IMPLEMENTATION (ENHANCED)
    def execute_upload(self, step):
        """Upload file với tùy chọn nâng cao"""
        xpath = step.get('xpath')
        file_path = step.get('file_path', '')
        wait_after = step.get('wait_after', 2)
        
        if xpath and file_path:
            # Resolve file path
            if not os.path.isabs(file_path) and self.upload_folder.get():
                file_path = os.path.join(self.upload_folder.get(), file_path)
            
            if os.path.exists(file_path):
                self.log_message(f"Uploading file: {file_path}")
                element = self.driver.find_element(By.XPATH, xpath)
                element.send_keys(file_path)
                
                if wait_after > 0:
                    time.sleep(wait_after)
                
                self.log_message("File upload successful", "SUCCESS")
            else:
                raise Exception(f"File not found: {file_path}")
        else:
            self.log_message("Missing xpath or file_path for upload", "WARNING")
        
        return True

    def execute_download(self, step):
        """Download file với timeout và verification"""
        xpath = step.get('xpath')
        save_path = step.get('save_path', '')
        wait_timeout = step.get('wait_timeout', 30)
        
        if xpath:
            self.log_message(f"Clicking download element: {xpath}")
            element = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, xpath))
            )
            
            # Get initial file list if save_path is provided
            initial_files = set()
            download_dir = save_path or self.download_path.get()
            if download_dir and os.path.exists(download_dir):
                initial_files = set(os.listdir(download_dir))
            
            element.click()
            self.log_message("Download initiated", "SUCCESS")
            
            # Wait for download completion
            if download_dir:
                start_time = time.time()
                while time.time() - start_time < wait_timeout:
                    current_files = set(os.listdir(download_dir))
                    new_files = current_files - initial_files
                    
                    # Check for completed downloads (no .crdownload or .tmp files)
                    completed_files = [f for f in new_files if not f.endswith(('.crdownload', '.tmp', '.partial'))]
                    
                    if completed_files:
                        self.log_message(f"Download completed: {completed_files[0]}", "SUCCESS")
                        break
                    
                    time.sleep(1)
                else:
                    self.log_message("Download timeout - file may still be downloading", "WARNING")
            else:
                # Just wait the specified timeout
                time.sleep(min(wait_timeout, 10))
        else:
            self.log_message("No xpath provided for download", "WARNING")
        
        return True

    def execute_screenshot(self, step):
        """Chụp màn hình với tùy chọn nâng cao"""
        save_path = step.get('save_path', '')
        full_page = step.get('full_page', False)
        element_xpath = step.get('element_xpath', '')
        
        if not save_path:
            save_path = f"screenshot_{int(time.time())}.png"
        
        # Ensure directory exists
        save_dir = os.path.dirname(save_path)
        if save_dir and not os.path.exists(save_dir):
            os.makedirs(save_dir)
        
        try:
            if element_xpath:
                # Screenshot specific element
                element = self.driver.find_element(By.XPATH, element_xpath)
                element.screenshot(save_path)
                self.log_message(f"Element screenshot saved: {save_path}", "SUCCESS")
            elif full_page:
                # Full page screenshot
                self.driver.save_screenshot(save_path)
                self.log_message(f"Full page screenshot saved: {save_path}", "SUCCESS")
            else:
                # Viewport screenshot
                self.driver.save_screenshot(save_path)
                self.log_message(f"Viewport screenshot saved: {save_path}", "SUCCESS")
        except Exception as e:
            raise Exception(f"Screenshot failed: {str(e)}")
        
        return True

    # CONTROL FLOW IMPLEMENTATION
    def execute_javascript(self, step):
        """Thực thi JavaScript với return value support"""
        script = step.get('script', '')
        return_variable = step.get('return_variable', '')
        
        if script:
            self.log_message("Executing JavaScript...")
            try:
                result = self.driver.execute_script(script)
                
                if return_variable and result is not None:
                    self.variables[return_variable] = result
                    self.log_message(f"JavaScript result saved to '{return_variable}': {result}", "SUCCESS")
                else:
                    self.log_message(f"JavaScript executed successfully. Result: {result}", "SUCCESS")
            except Exception as e:
                raise Exception(f"JavaScript execution failed: {str(e)}")
        else:
            self.log_message("No script provided for javascript step", "WARNING")
        
        return True

    def execute_condition(self, step):
        """Thực hiện conditional logic (simplified for linear execution)"""
        condition_type = step.get('condition_type', 'element_exists')
        xpath = step.get('xpath', '')
        expected_value = step.get('expected_value', '')
        variable_name = step.get('variable_name', '')
        
        result = False
        
        if condition_type == 'element_exists':
            if xpath:
                try:
                    self.driver.find_element(By.XPATH, xpath)
                    result = True
                except NoSuchElementException:
                    result = False
        
        elif condition_type == 'element_visible':
            if xpath:
                try:
                    element = self.driver.find_element(By.XPATH, xpath)
                    result = element.is_displayed()
                except NoSuchElementException:
                    result = False
        
        elif condition_type == 'text_contains':
            if xpath:
                try:
                    element = self.driver.find_element(By.XPATH, xpath)
                    text = element.text
                    result = expected_value.lower() in text.lower()
                except NoSuchElementException:
                    result = False
        
        elif condition_type == 'url_contains':
            current_url = self.driver.current_url
            result = expected_value.lower() in current_url.lower()
        
        elif condition_type == 'variable_equals':
            if variable_name in self.variables:
                result = str(self.variables[variable_name]) == str(expected_value)
        
        elif condition_type == 'variable_contains':
            if variable_name in self.variables:
                var_value = str(self.variables[variable_name])
                result = expected_value.lower() in var_value.lower()
        
        self.log_message(f"Condition '{condition_type}' evaluated to: {result}", "INFO")
        return result

    def execute_loop(self, step):
        """Simplified loop execution for linear workflow"""
        loop_type = step.get('loop_type', 'count')
        count = step.get('count', 5)
        max_iterations = step.get('max_iterations', 100)
        
        # For linear execution, we just log the loop info
        # Actual loop logic would require workflow restructuring
        self.log_message(f"Loop step noted: {loop_type} (this is placeholder for visual workflow)", "INFO")
        return True

    def show_variables(self):
        """Hiển thị các biến đã được lưu trữ"""
        if not self.variables:
            messagebox.showinfo("Variables", "No variables stored yet.")
            return
        
        var_text = "Stored Variables:\n\n"
        for key, value in self.variables.items():
            var_text += f"{key}: {str(value)[:100]}{'...' if len(str(value)) > 100 else ''}\n"
        
        # Create a new window to display variables
        var_window = tk.Toplevel(self.root)
        var_window.title("Variable Inspector")
        var_window.geometry("600x400")
        
        text_widget = scrolledtext.ScrolledText(var_window, wrap=tk.WORD)
        text_widget.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        text_widget.insert(tk.END, var_text)
        text_widget.config(state=tk.DISABLED)

    def run_automation_thread(self):
        """Chạy automation trong thread riêng với enhanced error handling"""
        try:
            self.update_status("Setting up browser...")
            if not self.setup_webdriver():
                return
            
            # Parse and prepare steps
            steps_data = self.selected_scenario.get('steps', [])
            if isinstance(steps_data, str):
                try:
                    steps_data = json.loads(steps_data)
                except json.JSONDecodeError:
                    raise Exception("Invalid JSON in scenario steps")
            
            # Convert visual workflow to linear if needed
            if isinstance(steps_data, dict) and steps_data.get('workflow_type') == 'visual':
                steps = self.convert_visual_to_linear(steps_data)
                self.log_message("Converted visual workflow to execution steps", "INFO")
            else:
                steps = steps_data if isinstance(steps_data, list) else []
            
            if not steps:
                raise Exception("No executable steps found in workflow")
            
            total_steps = len(steps)
            self.update_status(f"Running automation... (0/{total_steps})")
            
            successful_steps = 0
            for i, step in enumerate(steps, 1):
                if self.execution_stopped:
                    self.log_message("Automation stopped by user", "WARNING")
                    break
                
                try:
                    success = self.execute_step(step)
                    if success:
                        successful_steps += 1
                    self.update_status(f"Running automation... ({i}/{total_steps})")
                    
                    # Small delay between steps for stability
                    time.sleep(0.5)
                    
                except Exception as step_error:
                    self.log_message(f"Step {i} failed: {str(step_error)}", "ERROR")
                    # Continue with next step instead of stopping entire workflow
                    continue
            
            if not self.execution_stopped:
                self.log_message(f"Automation completed! {successful_steps}/{total_steps} steps successful", "SUCCESS")
                self.update_status(f"Automation completed ({successful_steps}/{total_steps})")
            
        except Exception as e:
            error_msg = f"Automation failed: {str(e)}"
            self.log_message(error_msg, "ERROR")
            self.update_status("Automation failed")
            messagebox.showerror("Automation Error", error_msg)
        finally:
            # Re-enable buttons
            self.root.after(0, self.automation_finished)
    
    def automation_finished(self):
        """Xử lý khi automation kết thúc"""
        self.run_btn.config(state="normal")
        self.stop_btn.config(state="disabled")
        self.debug_btn.config(state="disabled")
        
        if hasattr(self, 'driver') and self.driver:
            try:
                self.driver.quit()
                self.log_message("Browser closed", "INFO")
            except:
                pass
            finally:
                self.driver = None
                self.tab_handles = {}
                self.variables = {}
    
    def run_automation(self):
        """Bắt đầu chạy automation với enhanced validation"""
        if not self.selected_scenario:
            messagebox.showwarning("No Selection", "Please select a scenario first")
            return
        
        # Enhanced validation
        steps_data = self.selected_scenario.get('steps', [])
        if isinstance(steps_data, str):
            try:
                steps_data = json.loads(steps_data)
            except json.JSONDecodeError:
                messagebox.showerror("Invalid Data", "Selected scenario contains invalid JSON data")
                return
        
        # Convert and validate steps
        if isinstance(steps_data, dict) and steps_data.get('workflow_type') == 'visual':
            steps = self.convert_visual_to_linear(steps_data)
        else:
            steps = steps_data if isinstance(steps_data, list) else []
        
        if not steps:
            messagebox.showwarning("Empty Workflow", "No executable steps found in the selected workflow")
            return
        
        # Check configuration requirements
        needs_upload = any(step.get('type') == 'upload' for step in steps)
        needs_download = any(step.get('type') == 'download' for step in steps)
        
        if needs_upload and not self.upload_folder.get():
            messagebox.showwarning("Configuration Error", "Please select an upload folder")
            return
        
        if needs_download and not self.download_path.get():
            messagebox.showwarning("Configuration Error", "Please select a download path")
            return
        
        # Clear logs
        self.log_text.config(state="normal")
        self.log_text.delete(1.0, tk.END)
        self.log_text.config(state="disabled")
        
        # Reset execution state
        self.execution_stopped = False
        
        # Update UI state
        self.run_btn.config(state="disabled")
        self.stop_btn.config(state="normal")
        self.debug_btn.config(state="normal")
        
        # Start automation in separate thread
        self.log_message(f"Starting automation: {self.selected_scenario['name']}", "INFO")
        self.log_message(f"Total steps to execute: {len(steps)}", "INFO")
        
        automation_thread = threading.Thread(target=self.run_automation_thread)
        automation_thread.daemon = True
        automation_thread.start()
    
    def stop_automation(self):
        """Dừng automation"""
        try:
            self.execution_stopped = True
            self.log_message("Stop signal sent - automation will stop after current step", "WARNING")
            
            if hasattr(self, 'driver') and self.driver:
                # Give some time for current step to finish
                def force_stop():
                    time.sleep(2)
                    try:
                        if hasattr(self, 'driver') and self.driver:
                            self.driver.quit()
                            self.driver = None
                    except:
                        pass
                
                stop_thread = threading.Thread(target=force_stop)
                stop_thread.daemon = True
                stop_thread.start()
            
            self.update_status("Stopping...")
            
        except Exception as e:
            self.log_message(f"Error stopping automation: {str(e)}", "ERROR")

def main():
    """Hàm main với enhanced error handling"""
    root = tk.Tk()
    
    # Configure style
    style = ttk.Style()
    style.theme_use('clam')
    
    # Configure custom styles
    style.configure("Accent.TButton", foreground="white", background="#007ACC")
    style.map("Accent.TButton", 
              background=[('active', '#005A9E'), ('pressed', '#004578')])
    
    app = AutomationApp(root)
    
    try:
        root.mainloop()
    except KeyboardInterrupt:
        print("Application interrupted by user")
    except Exception as e:
        print(f"Application error: {str(e)}")
        messagebox.showerror("Application Error", f"An unexpected error occurred: {str(e)}")
    finally:
        # Cleanup
        if hasattr(app, 'driver') and app.driver:
            try:
                app.driver.quit()
            except:
                pass

if __name__ == "__main__":
    main()
